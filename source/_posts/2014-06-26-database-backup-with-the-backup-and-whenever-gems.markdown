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

# Setting It Up

To install Backup, log in to your VPS containing the data you'd like to backup and run the following:

``` bash
gem install backup
```

You can then run `backup` to familiarize yourself with all the commands it provides. We'll start things off by creating a Backup model, which is a description of whatever you want to backup. If you run 

``` bash
backup help generate:model
```

you'll see all the options we can use to tell Backup how we want our database backup to work. Below is the command I ran to create my model:

``` bash
backup generate:model --trigger=db_backup --databases='postgresql' --storages='scp' --compressor='gzip' --notifiers='mail'
```

As you can see, I'm first using the `--trigger` option to name my model `db_backup`. Then I'm using the `--databases` option to specify that I'll be backing up a PostgreSQL database. Next, I use `--storages` to tell Backup to use [SCP](https://en.wikipedia.org/wiki/Secure_copy) to transfer the backup file to my VPS (you could also use SFTP, rsync, Amazon AWS, or even Dropbox for this, among others). I then specify gzip as my file compressor, and finally, I tell Backup to notify me via email if the backup succeeded/failed.

When this command runs, it'll create a `~/Backup` directory with a `config.rb` and a `models/db_backup.rb` file (named after our trigger). The latter will hold configurations specific to the model we just created, while the former is for common configuration across multiple models. Since we're only creating a single model, we'll only modify the `models/db_backup.rb` file. 

This file will already contain some code corresponding, and all we need to do is fill in some missing information. As an example, here is what my own file looks like:

``` ruby db_backup.rb
# encoding: utf-8

# load login info
rails_env           = ENV['RAILS_ENV'] || 'production'
database_yml        = File.expand_path('/var/www/shared/config/database.yml')
db_config           = YAML.load_file(database_yml)[rails_env]
application_yml     = File.expand_path('/var/www/shared/config/application.yml')
app_config          = YAML.load_file(application_yml)

Model.new(:db_backup, 'backs up ip_addresses table') do

  # PostgreSQL [Database]
  database PostgreSQL do |db|
    db.name           = CONFIG[:database]
    db.username       = CONFIG[:username]
    db.password       = CONFIG[:password]
    db.host           = "localhost"
    db.only_tables    = ["ip_addresses"]
  end

  # SCP (Secure Copy) [Storage]
  store_with SCP do |server|
    server.username   = CONFIG[:backup_username]
    server.password   = CONFIG[:backup_password]
    server.ip         = CONFIG[:backup_ip]
    server.port       = CONFIG[:backup_port]
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

    mail.from               = CONFIG[:email_username]
    mail.to                 = CONFIG[:email_username]
    mail.address            = CONFIG[:email_address]
    mail.port               = CONFIG[:email_port]
    mail.domain             = CONFIG[:email_domain]
    mail.user_name          = CONFIG[:email_username]
    mail.password           = CONFIG[:email_password]
    mail.authentication     = :login
    mail.encryption         = :ssl
  end

end
```

I added the first few lines of code myself to load the necessary login information because I didn't want to hard-code things like usernames and passwords. 

The file contains four sections of code that correspond to the options we specified when we ran the `backup generate:model` command. The first section describes how to connect to my PostgreSQL database and tells Backup to only worry about the `ip_addresses` table since the data for all my other tables is saved in my `seed.rb` file. The second section describes how to connect to my VPS and specifies that I want the five most recent backups stored in the `~/backups` directory. The third section simply tells Backup to use gzip for comression. And the last section first tells Backup to only send an email if a warning or a failure occurs, and then it goes on to explain how and where to send it.

To make it easier to edit these files (and put them under version control), I suggest you recreate them on your local computer. I created a directory called `/backup` in my app's `/config` directory and stored them there. We'll later write a Capistrano task to upload them to the proper location on the VPS.

By the way, I chose not to hard-code things like usernames and passwords partly because I like to keep these things in a dedicated file, but mainly because I don't want them uploaded to my GitHub repo. I store my database information in the `database.yml` file, while email and VPS information is stored in `application.yml`. To make this data accessible in all 


# after filling in the details, run
backup perform -t db_backup
