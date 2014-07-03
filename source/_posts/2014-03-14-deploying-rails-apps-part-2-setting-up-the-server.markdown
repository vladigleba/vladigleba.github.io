---
layout: post
title: "Deploying Rails Apps, Part 2: Setting up the Server"
date: 2014-03-14 09:45
comments: true
categories: [Rails, Deployment, Phindee]
description: Learn how to install Node.js, Nginx, PostgreSQL, rbenv, Ruby, and Bundler.
---

In [part 1]({{ root_url }}/blog/2014/03/05/deploying-rails-apps-part-1-securing-the-server/), I talked about choosing a VPS provider, creating a new Ubuntu instance, and configuring it to be more secure. Now, in part 2, I'll talk about installing the technology stack behind [Phindee](http://phindee.com/): Node.js, Nginx, PostgreSQL, rbenv, Ruby, and Bundler.

<!-- more -->

# But First!

Before we proceed any further, make sure you’re logged in as the user you created in part 1; if you’re already logged in as `root`, you can switch to the correct user with the following command:

``` bash
su - username
```

Once logged in, we’ll run the following command to fetch the latest updates for the packages on our system:

``` bash
sudo apt-get update
```

We’ll follow this up with the command to install the necessary package updates:

``` bash
sudo apt-get upgrade
```

If the command found any updates to install, it will ask if you want to continue with the install; you can enter “y” to do so. Once it finishes, we’ll be ready begin.

# Setting Timezones and Installing Mail

We’ll start by setting the correct timezone:

``` bash
sudo dpkg-reconfigure tzdata
```

You’ll be asked to choose your country and timezone, after which your server’s local time will be displayed; if it displays the correct time, you’re good to go.

We’ll install `postfix` and `telnet` next to enable our Rails app to send email:

``` bash
sudo apt-get -y install telnet postfix
```

Feel free to just press “enter” through all the prompts and keep all the defaults. 

Next, we’ll install some useful packages we’ll later need, among them `python-software-properties`, which will allow us to easily add new repositories to the `apt` package handling system:

``` bash
sudo apt-get -y install curl git-core python-software-properties
```

Having the ability to add new repositories this way allows us to install the most recent updates since the default `apt-get` repositories typically don’t receive the latest updates immediately.

# Installing Node.js

We’ll actually put this ability to use right now by adding a new repository for [Node.js](http://nodejs.org/):

``` bash
sudo add-apt-repository ppa:chris-lea/node.js
```

We’ll then update the created repository with the latest Node.js code available:

``` bash
sudo apt-get -y update
```

and install it, like so:

``` bash
sudo apt-get -y install nodejs
```

We could’ve avoided adding a new repo and just used the traditional `apt-get` method to do the install, but this would’ve installed an older version of Node.js. Because Node.js is under active development and things are added quite frequently, it’s important to run the latest possible version. This might not matter as much for software that doesn’t have an aggressive update schedule, but this is the route we’ll take for Node.js.

By the way, if you’re wondering why we’re installing Node.js, the reason is it provides a good way to execute JavaScript, and we’ll need this for the Rails [asset pipeline](http://guides.rubyonrails.org/asset_pipeline.html).

# Installing Nginx

Next, we’ll install a web server called [Nginx](http://wiki.nginx.org/Main), which will handle all our static requests, such as stylesheets, scripts, images, and fonts. Its low memory usage and ability to serve static content quickly and efficiently make it a popular alternative to Apache and an excellent choice for sites running on a Virtual Private Server (VPS). What makes Nginx efficient is the fact that it’s an event-based server, while Apache, on the other hand, is process-based. An event-based server doesn't spawn new processes or threads for each request the way a process-based one does, and this means lower memory usage and faster responses.

We’ll install it by adding another repository:

``` bash
sudo add-apt-repository ppa:nginx/stable
sudo apt-get -y update
sudo apt-get -y install nginx
```

Once it’s installed, we can start it up with:

``` bash
sudo service nginx start
```

If you now visit your server’s IP address, you should see a simple page proclaiming “Welcome to nginx!”

# Installing PostgreSQL

Most modern apps need to store some sort of data, and there are a plethora of open source databases available, like [MySQL](https://www.mysql.com/), [SQLite](https://sqlite.org/), and [PostgreSQL](http://www.postgresql.org/). I never tried MySQL, but when I first started out, I used SQLite, the default database for Rails apps, because I liked its simplicity and saw no need for something more sophisticated. As my needs have evolved, however, so has my database, and I recently decided to switch to PostgreSQL because of its support for a fast key-value store called HStore and its ability to do full-text search, both of which I'll need for Phindee.

We’ll install it with `apt-get`:

``` bash
sudo apt-get install postgresql postgresql-contrib
```

We can then start Postgres as the default `postgres` user with the following command:

``` bash
sudo -u postgres psql
```

Had we not specified the default user, it would’ve tried to use the user we’re logged in with on our VPS, and Postgres would’ve complained that the role doesn’t exist since there is no such user created in Postgres. This makes it necessary to login as the default `postgres` user.

Once logged in, we’ll setup a password for `postgres`:

``` mysql
\password
```

We’ll also create a new user called `admin`, followed by a database called `phindee`, which will be owned by `admin`:

``` mysql
create user admin with password 'secret';
create database phindee owner admin;
```

Having the basics setup, we can now quit Postgres:

``` mysql
\quit
```

# Installing rbenv

[rbenv](https://github.com/sstephenson/rbenv) is a tool that helps you manage the Ruby versions installed on your system, thereby allowing you to easily switch between them. Whenever you want to play with a new version of Rails&mdash;without messing up your current setup&mdash;rbenv will come in handy.

You may be familiar with another Ruby version manager called [RVM](https://rvm.io/). I used it myself for a while, before switching over to rbenv. It’s not that one is “better” than the other; it’s about which one is better suited for <em>your</em> needs. I made the switch because rbenv is more lightweight than RVM, its design feels cleaner, and it has a cool name.

rbenv will suite you well if you’re starting out; otherwise, install whatever best meets your needs. By the way, it’s worth mentioning that since rbenv is incompatible with RVM, you won’t be able to run them side by side.

Alright, we can install rbenv like so:

``` bash
sudo curl -L https://raw.github.com/fesplugas/rbenv-installer/master/bin/rbenv-installer | bash
```

This will run a script that will do most of the install for us. In the end, you’ll receive a message telling you to add rbenv to the load path, and you can do so by opening up `bash_profile`:

``` bash
sudo nano ~/.bash_profile
```

and copying/pasting the code that was outputted by the message. We’ll then need to reload the file for the changes to take effect:

``` bash
. ~/.bash_profile
```

We’re almost ready to install Ruby, but before we do, we first need to install the C compiler and the Make utility, which is needed for the Ruby install. We can do so by installing a package called `build-essential`, along with some additional packages we’ll need later on:

``` bash
sudo apt-get install zlib1g-dev build-essential libssl-dev libreadline-dev libyaml-dev libsqlite3-dev sqlite3 libxml2-dev libxslt1-dev libpq-dev
```

With the packages installed, we’re now ready to install Ruby itself.

# Installing Ruby

To see a list of all the Ruby versions available, we can run the following command:

``` bash
rbenv install --list
```

I chose to install version 2.1.0, as that was the latest one at the time:

``` bash
rbenv install 2.1.0
```

This will take a few minutes to run&mdash;and that’s probably an understatement&mdash;but once it finishes, we’ll make the version it just installed the default Ruby version on our server:

``` bash
rbenv global 2.1.0
```

If everything finished successfully, typing `ruby -v` should output the Ruby version we now have installed.

# Installing Bundler

If you’ve never used it before, [Bundler](http://bundler.io/) is a tool that helps you easily manage and install gems (Ruby programs and libraries). It allows you to specify the gems your app relies on, along with their versions, and Bundler will then install them all for you, in addition to automatically installing and managing any dependencies (other gems) they rely on.

It’s usually a good idea to include version numbers for your gems because new versions can sometimes introduce changes that cause the old features you rely on to behave differently, which can result in errors the next time you try to run your app. By using Bundler to specify not only the gems you need, but also the versions of those gems, you can save yourself from needless headaches (and unnecessary cups of coffee).

We will install bundler with the following command:

``` bash
gem install bundler --no-ri --no-rdoc
```

Every time we install a gem that provides us with commands we can execute, we’ll need to run `rbenv rehash`, which will give us access to the corresponding executable ([see this page](http://stackoverflow.com/questions/9394338/how-do-rvm-and-rbenv-actually-work) to learn why this is so). Since Bundler is one of these gems, we’ll do the rehash next:

``` bash
rbenv rehash
```

If things installed successfully, `bundle -v` should return the Bundler version that was just installed.

As an aside, notice that we’re specifying the `—no-ri` and `—no-rdoc` flags to avoid installing the gem’s documentation, which often takes longer than the gem installation itself and is typically unnecessary, especially on a production server. But typing out these flags for each and every gem you install will give you [carpel tunnel](http://www.webmd.com/pain-management/carpal-tunnel/carpal-tunnel-syndrome-topic-overview) sooner than you'd like, so its best to create a `.gemrc` file in your home directory:

``` bash
nano ~/.gemrc
```

and add the following line into it:

``` text
gem: --no-rdoc --no-ri
```

The flags will then be included automatically the next time you install new gems.

And with that, our server setup is now complete! Having installed Node.js, Nginx, PostgreSQL, and rbenv, we’re now ready to start configuring Nginx and Unicorn, which I’ll cover in the [next post]({{ root_url }}/blog/2014/03/21/deploying-rails-apps-part-3-configuring-unicorn/). If you want to be notified when it’s out, feel free to [subscribe](http://www.feedblitz.com/f/?Sub=927939&cids=1), and you’ll have the complete post delivered to your inbox as soon as it’s released!
