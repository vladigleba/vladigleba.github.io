---
layout: post
title: "Deploying Rails Apps, Part 5: Configuring Capistrano"
date: 2014-04-04 07:36
comments: true
categories: [Deployment, Phindee]
description: Learn how to configure Capistrano for deployment.
---

In the previous four posts, I covered how I went about setting up my server for Phindee and how I configured Unicorn and Nginx. Here in part 5, I will now talk about how I configured Capistrano to actually deploy Phindee. 

<!-- more -->

If you’re not familiar with it, [Capistrano](http://capistranorb.com/) is the de-facto deployment tool for Rails apps; it makes deployment easier by automating a lot of the work for you, and it can be easily customized to suit your particular needs. If you’ve never used it before, I hope this post will give you a taste of what it can do.

By the way, I’ll be using version 3, which came out last summer; it’s a complete rewrite that ended up reducing Capistrano’s footprint to just 700 lines of code! If you’re coming from version 2, I recommend reading [this post](https://semaphoreapp.com/blog/2013/11/26/capistrano-3-upgrade-guide.html) to learn about the differences.

One of the ways the core team was able to keep it so lean was by breaking framework-specific tasks into separate gems, which means that in addition to installing the Capistrano gem itself, we’ll need to install Rails-specific gems as well. Here is what you should add to your `Gemfile`:

``` ruby Gemfile
. . .

group :development do
  gem 'capistrano', '~> 3.2.1'
  gem 'capistrano-rails', '~> 1.1.1'
  gem 'capistrano-bundler', '~> 1.1.2'
  gem 'capistrano-rbenv', '~> 2.0.2'
end
```

Since we’ll only be using Capistrano in development, we put all the gems in the `:development` group. Note that we added Rails-specific tasks through the `capistrano-rails` gem, Bundler-specific tasks through the `capistrano-bundler` gem, and rbenv-specific tasks through the `capistrano-rbenv` gem.

We can install them by running `bundle` in the root directory of our Rails app. After Bundler finishes the install, we’ll tell Capistrano to create the necessary files it needs to do its job by running the following:

``` bash
cap install
```

One of the files this created is called `Capfile`, which will be located in the root directory of your Rails app. It'll contain various `require` statements to load the necessary code that Capistrano will need to do its job. We’ll open it up and uncomment the following lines to load the gems we just installed:

``` ruby Capfile
require 'capistrano/rails'
require 'capistrano/bundler'
require 'capistrano/rbenv'
```

You’ll also see the following line at the end of the file:

``` ruby Capfile
Dir.glob('lib/capistrano/tasks/*.rake').each { |r| import r }
```

This will load any custom tasks from `lib/capistrano/tasks`, which we will later define.

# Roll up Your Sleeves

One cool thing about Capistrano is it’s designed to work with different deployment scenarios. You could, for example, have both a production server running your “live” application and a staging server meant for testing newly developed features before they’re pushed to the production server. In other words, you’d have two deployment stages: production and staging. When we ran `cap install`, Capistrano actually already created the necessary files for this; they’re located inside the `/config/deploy` directory and are named `production.rb` and `staging.rb`, respectively. We’ll use them to define stage-specific configurations, while configurations that are meant to be shared across all stages will be set in `config/deploy.rb`, and that’s where we’ll start first.

## General Configuration

Below is how my `deploy.rb` file looks like for Phindee:

``` ruby deploy.rb
lock "3.2.1"

set :application, "phindee"
set :repo_url, "git@github.com:vladigleba/phindee.git"

set :deploy_to, "/var/www/#{fetch(:application}"
set :deploy_user, "bob"

set :rbenv_type, :user # or :system, depends on your rbenv setup
set :rbenv_ruby, "2.1.0"
set :rbenv_prefix, "RBENV_ROOT=#{fetch(:rbenv_path)} RBENV_VERSION=#{fetch(:rbenv_ruby)} #{fetch(:rbenv_path)}/bin/rbenv exec"
set :rbenv_map_bins, %w{rake gem bundle ruby rails}
set :rbenv_roles, :all # default value

set :linked_files, %w{config/database.yml}
set :linked_dirs, %w{bin log tmp/pids tmp/cache tmp/sockets vendor/bundle public/system}

set :keep_releases, 5
```

The very first line locks the configurations in this file to Capistrano 3.1, and if you have any other version installed, the file won’t run. (This is designed to help prevent configurations from braking between version updates.)

Next, we’re using the `set()` function to initialize the `:application` variable to “phindee.” (We’ll retrieve this variable’s value later using the corresponding `fetch()` function.) We’re also setting the `:repo_url` variable to the URL of the GitHub repository containing your code so Capistrano  knows where to look when we deploy. By the way, if your code is on a branch other than “master,” you’ll need to specify its name by adding `set :branch, “branch-name”`; otherwise, this is not needed because Capistrano sets it to “master” by default.

The next line sets the `:deploy_to` variable to the path where you want Capistrano storing the code it downloads from GitHub. This should be the same path you previously set in `unicorn.rb`, but without the `/current` directory appended to it. This is because `/current` represents the directory with the latest deploy code, while Capistrano is interested in the general app directory.

`:deploy_user` is then set to the user Capistrano will be deploying as, and this should match the user you created when you setup your server in [part 1]({{ root_url }}/blog/2014/03/05/deploying-rails-apps-part-1-securing-the-server/).

The next few lines set variables needed by rbenv, and I actually copied and pasted these lines from the `capistrano-rbenv` [README file](https://github.com/capistrano/rbenv). The key variable here is `:rbenv_ruby`, which sets the Ruby version that rbenv installed on your machine, and you can run `ls ~/.rbenv/versions` in the command line to find which version that is. If this is not set correctly, the deploy will fail.

The other variable worth mentioning here is `:rbenv_type`. We could set it to `:system` if rbenv was installed system-wide on our machine, but since we installed rbenv on a per-user basis inside `~/.rbenv`, we're setting it to `:user`. System-wide installs can lead to problems with permissions, and it’s generally cleaner to just do a per-user install. The other three variables don’t need to be modified, and you can leave them the way they are.

Moving on, we’re setting the `:linked_files` variable to an array of strings initialized to `config/database.yml`. This tells Capistrano to store our app’s `config/database.yml` file inside a directory called `/shared`, which is meant for any files we want to persist between deploys. Since the contents of `database.yml` won’t change between deploys, it’s a good idea to store it there.

Similarly, `:linked_dirs` contains <em>directories</em> that are meant to persist between deploys, and they too will be stored inside `/shared`. These include directories containing things like log files, Unicorn sockets, and `.pid` files that will all stay the same between deploys.

And finally, `:keep_releases` tells Capistrano to only keep the last 5 deploys and discard everything else. This can be useful whenever you need to rollback to a previous release, but you also don't want releases piling up, so it's best not to set this number too high.

## Stage-Specific Configuration

Now that `deploy.rb` is configured, we’ll move on to defining stage-specific configurations. Since I currently don’t have a separate environment for staging, I’ll only be going over the `config/deploy/production.rb` file, and you can just leave `staging.rb` the way it is by default. Below is how my `production.rb` file looks like:

``` ruby production.rb
set :stage, :production
set :rails_env, :production

server 'xxx.xxx.xxx.xxx', user: 'bob', port: 12345, roles: %w{web app db}, primary: true
```

As you can see, there isn’t much going on here. We’re first setting the `:stage` variable to `:production` to let Capistrano know that this file is meant for production. We’re also setting the `:rails_env` variable to the same thing to make sure Rails runs in the production environment. But the key line is the last line, which tells Capistrano how to access our VPS server. Make sure you replace the Xs with the IP address of the server you setup in part 1, along with the user and port number it's set up with. 

We’re then using the `:roles` variable to let Capistrano know that our database server (PostgreSQL) represented by `db`, web server (Nginx) represented by `web`, and application server (Unicorn) represented by `app` all run on the same machine. Apps with lots of traffic, on the other hand, might have multiple separate physical servers for each of these. Setting `:primary` to `true` then tells Capistrano that this is our primary database server, and Capistrano will run migrations only on the one we designate as `:primary`. Even if we’re running all our servers on the same physical machine, setting `:primary` is still necessary.

# Enabling Agent Forwarding

Now that Capistrano knows how to access our VPS, we need to make sure it can also access our code on GitHub. We’ll be using agent forwarding to allow us to reuse the local key we generated in part 1 to authenticate with GitHub. In order for this to work, we’ll need to add the key to GitHub, and you can do so by following step 3 on [this GitHub page](https://help.github.com/articles/generating-ssh-keys#step-3-add-your-ssh-key-to-github).

To enable agent forwarding in Capistrano 2, you had explicitly set it in `deploy.rb`, but in Capistrano 3, it’s already taken care of and enabled by default. The only thing we have left to do is log in to our VPS and run the following command to add github.com to the list of known hosts; this ensures Capistrano won’t have any problems with it being unknown when it tries downloading your code from GitHub to your server:

``` bash
ssh git@github.com
```

You’ll get a warning asking if you’re sure you want to continue connecting. Verify that the key fingerprint matches the one you just added to GitHub, and enter “yes”. If you get an “access denied” message, see [this page](https://help.github.com/articles/error-permission-denied-publickey) for potential solutions. If you’re experiencing some other agent forwarding problems, [this page](https://help.github.com/articles/using-ssh-agent-forwarding#troubleshooting) might help you out.

# Setting Permissions

If you look at `deploy.rb`, you’ll notice I set the `:deploy_to` variable to “/var/www/phindee,” but on my VPS, the `/var` directory doesn’t yet contain the `/www` directory. That’s not a problem since Capistrano will create it for me through the user `bob`, as specified in `deploy.rb`, but it needs write permissions to do so.

If you read [part 1]({{ root_url }}/blog/2014/03/05/deploying-rails-apps-part-1-securing-the-server/), you’ll remember we created a group called `deployers` to contain users with deployment privileges and added the user `bob` into it. This means we can give the necessary permissions `bob` will need by simply giving them to `deployers`, and since `bob` is a member of the group, he will automatically inherit them.

I’m already logged in to my VPS as `bob`, and I can change the `/var` directory’s group to `deployers` with the following command:

``` bash
sudo chgrp deployers /var
```

We can then give this group write permissions so its members can create directories within `/var`:

``` bash
sudo chmod g+w /var
```

There are two other places where we need to repeat this process. The first is the `/etc/nginx/sites-enabled` directory, which Nginx uses to store its configuration files, and this is where our `config/nginx.conf` file that we created in [part 4]({{ root_url }}/blog/2014/03/27/deploying-rails-apps-part-4-configuring-nginx/) will go. But we actually won’t be storing the file itself there; we’ll create a symlink to it, instead. This will make our deploys easier to manage because we won’t need to add our `nginx.conf` file to the `/etc/nginx/sites-enabled` directory <em>every</em> time we deploy. We can simply symlink it since Capistrano will always store our latest deploy code in the same place (`/var/www/phindee/current`).

Same thing is needed for the `config/unicorn_init.sh` file from [part 3]({{ root_url }}/blog/2014/03/21/deploying-rails-apps-part-3-configuring-unicorn/). We’ll need to create a symlink inside `/etc/init.d`, since that’s the directory Linux uses to store all the shell scripts used to manage the various services installed on the system. When we installed Nginx in [part 2]({{ root_url }}/blog/2014/03/14/deploying-rails-apps-part-2-setting-up-the-server/), for example, a shell script was automatically installed there to help us manage Nginx, and it will be invoked whenever we run a command like `sudo service nginx restart`. There is nothing like this for Unicorn yet, which is why we need to create a symlink to our `unicorn_init.sh` script to give us similar functionality.

In order for Capistrano to create symlinks, it needs write permissions in the relevant directories. We can give them with the following commands:

``` bash
sudo chgrp deployers /etc/nginx/sites-enabled
sudo chmod g+w /etc/nginx/sites-enabled

sudo chgrp deployers /etc/init.d
sudo chmod g+w /etc/init.d
```

And now Capistrano should have the necessary permissions to do its work. 

Having Capistrano configured, we’re ready to move on and start writing custom tasks to help us deploy our code, and that’s exactly what we’ll do in the [next and last post]({{ root_url }}/blog/2014/04/10/deploying-rails-apps-part-6-writing-capistrano-tasks/) of this series. If you want to be notified when it’s out, feel free to [subscribe](http://www.feedblitz.com/f/?Sub=927939&cids=1), and you'll get it delivered to your inbox as soon as it’s released.
