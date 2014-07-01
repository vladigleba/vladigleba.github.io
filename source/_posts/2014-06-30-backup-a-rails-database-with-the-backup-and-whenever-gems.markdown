---
layout: post
title: "Backup a Rails Database with the Backup and Whenever Gems"
date: 2014-06-30 16:07
comments: true
categories: [Rails, Databases, Phindee]
description: Learn how to backup your Rails database with the Backup and Whenever gems.
---

[Phindee](http://phindee.com/) users recently got the ability to "like" happy hours. Up until that point, all my happy hour data was safely stored in a version controlled `seed.rb` file, but now I was dealing with data that was dynamically generated and not being backed up anywhere. And that is not a good thing.

<!-- more -->

So I went over to [ruby-toolbox.com](https://www.ruby-toolbox.com/categories/backups) to familiarize myself with the various backup tools available for Ruby projects. The [Backup gem](https://github.com/meskyanichi/backup) caught my eye as it was (and is) the most popular one by far. After reading a bit about it, I was impressed by its ease of use and its extensive [list of features](http://meskyanichi.github.io/backup/v4/). I knew I had to try it out.

Having now used it for a few weeks, I'd like to explain how I set it up, so you can take advantage of it as well.

# Setting Up Backup

Setting up Backup is as straightforward as it gets. Log in to the VPS running your database and install Backup:

``` bash
gem install backup
```

You can then run `backup` to familiarize yourself with all the commands it provides. We'll start out by creating a Backup model, which is simply a description of how a backup will work. If you run 

``` bash
backup help generate:model
```

you'll see all the options available for describing how we want our backup to function. Below is the command and options I used to create my model:

``` bash
backup generate:model --trigger=db_backup --databases='postgresql' --storages='scp' --compressor='gzip' --notifiers='mail'
```

As you can see, I'm first using the `--trigger` option to create a model called `db_backup`. Then I'm using the `--databases` option to specify that I'll be backing up a PostgreSQL database. (Basides PostgreSQL, Backup also supports MySQL, MongoDB, Redis, and Riak.)

Next, I use `--storages` to tell Backup how to perform the backup itself. By specifying `scp`, I'm saying that the backup file should be stored on a secondary VPS, and it should be transferred there via [SCP](https://en.wikipedia.org/wiki/Secure_copy). (Ideally, your secondary VPS should be in a location that's different from the VPS running your database.) In addition to SCP, Backup also supports rsync, FTP/SFTP, S3, Dropbox, and [a few others](http://meskyanichi.github.io/backup/v4/storages/).

I then specify that I want my backup to be compressed with gzip (you could also use bzip2, if you'd like), and finally, I tell Backup to notify me via email if the backup succeeded or failed. If you dislike email, your other options include Twitter, Prowl, Campfire, Hipchat, and [others](http://meskyanichi.github.io/backup/v4/notifiers/).

Once this command runs, it'll create a `~/Backup` directory containing two files: `config.rb` and `models/db_backup.rb` (named after our trigger). The latter will hold configuration specific to the model we just created, while the former is for common configuration across multiple models. Since we're only creating a single model, we'll only modify the `models/db_backup.rb` file, which will already contain some code corresponding to the options we just specified.

If you ran the command above, the file should look something like this:

``` ruby db_backup.rb
# encoding: utf-8

# load login info
db_config           = YAML.load_file('/var/www/phindee/shared/config/database.yml')['production']
app_config          = YAML.load_file('/var/www/phindee/shared/config/application.yml')

Model.new(:db_backup, 'backs up ip_addresses table') do

  # PostgreSQL [Database]
  database PostgreSQL do |db|
    db.name           = db_config['database']
    db.username       = db_config['username']
    db.password       = db_config['password']
    db.host           = "localhost"
    db.only_tables    = ["ip_addresses"]
  end

  # SCP (Secure Copy) [Storage]
  store_with SCP do |server|
    server.username   = app_config['backup_username']
    server.password   = app_config['backup_password']
    server.ip         = app_config['backup_ip']
    server.port       = app_config['backup_port']
    server.path       = "~/backups/"
    server.keep       = 5
  end

  # Gzip [Compressor]
  compress_with Gzip

  # Mail [Notifier]
  notify_by Mail do |mail|
    mail.on_success         = false
    mail.on_warning         = true
    mail.on_failure         = true

    mail.from               = app_config['email_username']
    mail.to                 = app_config['email_username']
    mail.address            = app_config['email_address']
    mail.port               = app_config['email_port']
    mail.domain             = app_config['email_domain']
    mail.user_name          = app_config['email_username']
    mail.password           = app_config['email_password']
    mail.authentication     = :login
    mail.encryption         = :ssl
  end

end
```

Since I store my database information in the `database.yml` file and my email and VPS information in `application.yml`, I added two lines in the beginning to load the necessary login information from these files using the `load_file()` method from the YAML module. I recommend you do the same because it's best to keep these things in a dedicated file, instead of hard-coding them in every time.

Let's now go over our `db_backup` model, which consists of four sections. Because we specified PostgreSQL for the `--databases` option, the first section contains configuration that is specific to PostgreSQL. It collects our database name, username, password, and host, along with an array of tables to back up. This array is optional and should be used only if you don't want your entire database backed up. (I used it because the `ip_addresses` table is the only table I'm interested in backing up since the data for all my other tables is saved in `seed.rb`.)

The second section describes how to connect to our secondary VPS. After setting the username, password, IP address, and port, I specify the path where the backups will be stored, and I tell Backup to keep only the five most recent ones. The third section simply tells Backup to use gzip for compression, while the last contains settings for setting up email notifications, which tell Backup to only send an email if a warning or a failure occurs.

Once our `db_backup.rb` file is configured, we can run it with the following command:

``` bash
backup perform -t db_backup
```

If all went well, you should be able to find a gzipped backup file on your secondary VPS.

# Setting Up Whenever

Okay, this is all great, but wouldn't it be cool if the backup was done automatically without you having to trigger it? Well, this is possible with a tool called [cron](https://en.wikipedia.org/wiki/Cron). If you're not familiar with it, cron is a scheduling utility that allows you to run tasks (which are known as cron jobs) at specified times. You can use it to automate any task that needs to be run at regular intervals. If you've never used it before, DigitalOcean has a good introductory [article](https://www.digitalocean.com/community/tutorials/how-to-schedule-routine-tasks-with-cron-and-anacron-on-a-vps) that's definitely worth a read.

To write our cron jobs, we'll be using a gem called [Whenever](https://github.com/javan/whenever), because it allows us to write them in a simpler, more expressive Ruby syntax, instead of the standard cron syntax.

Go ahead and install Whenever on the server running Backup:

``` bash
gem install whenever
```

When that finishes, create a `/config` directory for Whenever inside `~/Backup`:

``` bash
cd ~/Backup
mkdir config
```

Then run:

``` bash
wheneverize .
```

This will create a `schedule.rb` file in `~/Backup/config` for writing your cron jobs. Below is the code I added to mine:

``` ruby schedule.rb
every 1.day, :at => '11:30 pm' do
  command "backup perform -t db_backup"
end

```

The code pretty much explains itself: everyday at 11pm, cron will run the `backup perform -t db_backup` command. If you'd like to see this converted to cron syntax, run `whenever`:

``` bash
$ whenever
30 23 * * * /bin/bash -l -c 'backup perform -t db_backup >> /home/bob/Backup/config/cron.log 2>&1'
```

This is known as your crontab (which stands for cron table), and it lists all the jobs cron is scheduled to run, along with the time and day they'll run.

The first column, for example, defines the minute (0-59) at which the command will run, while the second column defines the hour (0-23) in military time. The third  column defines the day of the month, while the fourth defines the month itself (1-12).

If you want your jobs running on a weekly basis, you can use the fifth column to specify the day of the week (with Sunday being represented by both 0 and 7). You could even use hyphens (-) to specify ranges and commas to specify multiple values, if you'd like. (See the previously mentioned [article by DigitalOcean](https://www.digitalocean.com/community/tutorials/how-to-schedule-routine-tasks-with-cron-and-anacron-on-a-vps) to learn more.)

Because running `whenever` didn't actually write our job to crontab, we'll need to run 

``` bash
whenever --update-crontab
```

to do so. Having done that, cron will now know about our job, and it'll get executed at the specified time and day. When it runs, it'll also log its activity in a `~/Backup/config/cron.log` file for future reference.

# Hooking Things Up with Capistrano

In order to make it easier to edit these files in the future, I decided to recreate them on my local computer and store them in my app's `/config` directory in a folder called `/backup`, which means they'll now be under version control as well. And since I use Capistrano for deployment, I wrote two tasks to automate the process of uploading these files back to the server. They reside in a file called `backup.cap` in my app's `/lib/capistrano/tasks` directory:

``` ruby backup.cap
namespace :backup do
  
  desc "Upload backup config files."
  task :upload_config do
    on roles(:app) do
      execute "mkdir -p #{fetch(:backup_path)}/models"
      upload! StringIO.new(File.read("config/backup/config.rb")), "#{fetch(:backup_path)}/config.rb"
      upload! StringIO.new(File.read("config/backup/models/db_backup.rb")), "#{fetch(:backup_path)}/models/db_backup.rb"
    end
  end
  
  desc "Upload cron schedule file."
  task :upload_cron do
    on roles(:app) do
      execute "mkdir -p #{fetch(:backup_path)}/config"
      execute "touch #{fetch(:backup_path)}/config/cron.log"
      upload! StringIO.new(File.read("config/backup/schedule.rb")), "#{fetch(:backup_path)}/config/schedule.rb"
        
      within "#{fetch(:backup_path)}" do
        # capistrano was unable to find the executable for whenever
        # without the path to rbenv shims set
        with path: "/home/#{fetch(:deploy_user)}/.rbenv/shims:$PATH" do
          puts capture :whenever
          puts capture :whenever, '--update-crontab'
        end
      end
    end
  end
  
end

```

And inside my `/config/deploy.rb` file, I then have the following definition for the `backup_path` variable:

``` ruby deploy.rb
. . .

set :backup_path, "/home/#{fetch(:deploy_user)}/Backup"

. . .
```

(If this is all new to you, feel free to read my posts explaining [how to configure Capistrano](http://vladigleba.com/blog/2014/04/04/deploying-rails-apps-part-5-configuring-capistrano/) and [how to write Capistrano tasks](http://vladigleba.com/blog/2014/04/10/deploying-rails-apps-part-6-writing-capistrano-tasks/) to quickly get up to speed.)

And with that, our backup functionality is complete. You'll now have a backup of your database stored on a secondary VPS every 24 hours without you having to lift a finger! And it even notifies you if it fails!

Life is good.
