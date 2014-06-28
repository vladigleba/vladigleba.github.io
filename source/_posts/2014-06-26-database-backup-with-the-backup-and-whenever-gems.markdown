---
layout: post
title: "Backup Your Rails Database with the Backup and Whenever Gems"
date: 2014-06-26 16:22
comments: true
categories: [Rails, Storage, Phindee]
description: Learn how to backup your Rails database with the Backup and Whenever gems.
---

I recently gave [Phindee]() users the ability to "like" happy hours. Up until that point, all my happy hour data was safely stored in a version-controlled `seed.rb` file, but now I was dealing with data that was dynamically generated and not being backed up anywhere. And that is not a good thing.

<!-- mroe -->

So I went over to the [ruby-toolbox.com](https://www.ruby-toolbox.com/categories/backups) "Backups" section to familiarize myself with the various backup tools available for Ruby projects. The [Backup gem](https://github.com/meskyanichi/backup) caught my eye as it was (and is) the most popular one by far. After doing a bit of reading about it, I was impressed by its ease of use (not to mention all the [features it supports](http://meskyanichi.github.io/backup/v4/)). I knew I had to try it out.

Having now used it for a few weeks, I'd like to explain how I set it up, so you can take advantage of it as well.

# Setting Up Backup

Log in to the VPS running your database and install Backup:

``` bash
gem install backup
```

You can then run `backup` to familiarize yourself with all the commands it provides. We'll start things off by creating a Backup model, which is simply a description of how a backup will work. If you run 

``` bash
backup help generate:model
```

you'll see all the options we can use to describe how we want our backup to work. Below is the command I ran to create my model:

``` bash
backup generate:model --trigger=db_backup --databases='postgresql' --storages='scp' --compressor='gzip' --notifiers='mail'
```

As you can see, I'm first using the `--trigger` option to create a model called `db_backup`. Then I'm using the `--databases` option to specify that I'll be backing up a PostgreSQL database. Next, I use `--storages` to tell Backup how to perform the backup. By specifying `scp`, I'm saying that the backup file should be stored on a secondary VPS, and it should be transferred there via [SCP](https://en.wikipedia.org/wiki/Secure_copy). (Ideally, your secondary VPS should be in a location that's different from the VPS running your database.) I then specify that I want my backup to be compressed with gzip, and finally, I tell Backup to notify me via email if the backup succeeded or failed.

When this command runs, it'll create a `~/Backup` directory with a `config.rb` and a `models/db_backup.rb` file (named after our trigger). The latter will hold configurations specific to the model we just created, while the former is for common configuration across multiple models. Since we're only creating a single model, we'll only modify the `models/db_backup.rb` file, which will already have some configuration corresponding to the options we just specified.

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

Apart from the first few lines, your own file will look very similar. Since I store my database information in the `database.yml` file and my email and VPS information in `application.yml`, I added two lines in the beginning to load the necessary login information from these files using the `load_file()` method from the YAML module. I recommend you do the same because it's best to keep these things in a dedicated file, instead of hard-coding them in every time.

Let's now go over our `db_backup` model, which consists of four sections.

Since we specified PostgreSQL for the `--databases` option, the first section contains configuration that is specific to PostgreSQL. It collects our database name, username, password, and host, along with an array of tables to back up. This last line is optional and should be used only if you don't want your entire database backed up. (I used it because the `ip_addresses` table is the only table I'm interested in backing up since the data for all my other tables is saved in my `seed.rb` file.)

The second section describes how to connect to our secondary VPS and specifies that we want the five most recent backups stored in the `~/backups` directory. The third section simply tells Backup to use gzip for comression. And the last section first tells Backup to only send an email if a warning or a failure occurs, and then it goes on to explain how and where to send it.

Once our `db_backup.rb` file is configured, we can try running it with the following command:

``` bash
backup perform -t db_backup
```

If all went well, you should be able to find a gzipped backup file on your secondary VPS.

Okay, this is all great, but wouldn't it be cool if the backup was done automatically without you having to trigger it? Well, this is possible with a tool called Cron. 

To make it easier to edit these files (and put them under version control), I suggest you recreate them on your local computer. I created a directory called `/backup` in my app's `/config` directory and stored them there. We'll later write a Capistrano task to upload them to the proper location on our VPS.