---
layout: post
title: "Provisioning a Rails Server Using Chef, Part 3: Tying It All Together"
date: 2014-08-13 15:02
comments: true
categories: [Server Provisioning, Phindee]
description: 
---

We installed Chef Solo in [part 1]({{ root_url }}/blog/2014/07/28/provisioning-a-rails-server-using-chef-part-1-introduction-to-chef-solo/), we wrote some recipes in [part 2]({{ root_url }}/blog/2014/08/12/provisioning-a-rails-server-using-chef-part-2-writing-the-recipes/), and now we'll be tying everything together in part 3. When we're done, we'll not only have a fully provisioned server running your Rails app, but we'll also have an automated way of repeating this process whenever such a need arises in the future.

## Some Groundwork

Before we can run the recipes from part 2, we need to specify exactly which recipes want to run and in what order using what's called a run list. We store the run list in the JSON file located in the `/nodes` directory (I usually add it to top of the file, before all the node-specific attributes, to make it easy to spot). Here's what it looks like:

``` json 123.123.123.123.json
{
  "run_list": [
    "recipe[phindee]",
    "recipe[phindee::users]",
    "recipe[phindee::ssh]",
    "recipe[phindee::nodejs]",
    "recipe[phindee::postgres]",
    "recipe[phindee::rbenv]",
    "recipe[phindee::redis]",
    "recipe[phindee::nginx]",
    "recipe[phindee::app]"
  ],
  
  . . .
}

Because Chef executes the run list in the exact order it's specified, it's important to list the recipes that other recipes will depend on first. Some of our recipes, for example, use the user that's created in `users.rb`, so that's why we place that recipe near the top, but recipes that don't depend on any other recipes can be placed anywhere you want. (Note that when referencing the `default.rb` recipe, it's enough to just specify the name of the cookbook it's located in, but in order to run the other recipes, it's necessary to specify the cookbook, along with the recipe's file name.)

By the way, if you ever find yourself not needing/wanting a particular recipe to run, all you need to do is remove that particular recipe from the run list, and Chef won't run it, but do be careful about removing recipes that other recipes depend on because that will create issues.

With our run list defined, we're now ready to start the provisioning process. Because we'll need to use quite a number of commands to get everything provisioned, it's best to automate this by creating a shell script. I created a file called `setup_vps.sh` inside my app's `/config` directory, and here's the  code it contains:

``` bash setup_vps.sh
#!/bin/sh

# check for correct number of arguments
if [ $# -ne 3 ]; then
  echo "Usage: $0 <user> <ip> <port>"
  exit 1
fi

# set variables
USER=$1
IP=$2
PORT=$3 

# upload key for root
ssh-copy-id -i ~/.ssh/id_rsa.pub root@$IP

# install chef
cd config/chef && knife solo prepare root@$IP

# execute the run list
knife solo cook root@$IP

# upload key for user
ssh-copy-id -i ~/.ssh/id_rsa.pub -p $PORT $USER@$IP

# setup phindee code
cd ../.. && cap production setup:all

# restart nginx
ssh -p $PORT -t $USER@$IP 'sudo service nginx restart'
```

The first line uploads your public key to the node (server) you're about to provision. (If you don't do this, Chef Solo will ask you to type your password for every command it runs.) The next line installs Chef on our node using the `knife solo prepare` command, while the line after uses `knife solo cook` to execute our run list. When it finishes, our node will be fully provisioned.

The remaining three lines run my Capistrano recipes to deploy my app (if you're not using Capistrano for deployment, feel free to remove them). The third to last line uploads the public key for the Chef-created user (so Capistrano can log in without a password), the next line runs the Capistrano recipes, and the last line restarts Nginx (so the uploaded Rails app is loaded in).

Once you run `chmod +x setup_vps.sh` to make the file an executable, you can `cd` into the directory containing the script and run it with `./setup_vps.sh bob 123.123.123.123 12345`, where `bob` is the Chef-created user, `123.123.123.123` is the IP address to the node you just provisioned, and `12345` is its port.

In the interest of completeness, below is my `setup.rake` file containing the `all` task that I'm referencing above:

``` ruby setup.rake
namespace :setup do
  
  desc "Runs all tasks."
  task all: [:deploy, :seed_postgres, :seed_redis]
  
  desc "Seed the main database."
  task :seed_postgres do
    on roles(:app) do
      within "#{current_path}" do
        with rails_env: :production do
          execute :rake, "db:seed"
        end
      end
    end
  end

  desc 'Seed the redis database (search suggestions)'
  task :seed_redis do
    on roles(:app) do
      within "#{current_path}" do
        with rails_env: :production do
          execute :rake, "search_suggestions:index"
        end
      end
    end
  end
  
  after "deploy:published", "deploy:start"
  
end
```

and here's my `deploy.rake` file containing the `start` task that I'm calling in `setup.rake`:

``` deploy.rake
namespace :deploy do
  
  desc "Makes sure local git is in sync with remote."
  task :check_revision do
    unless `git rev-parse HEAD` == `git rev-parse origin/master`
      puts "WARNING: HEAD is not the same as origin/master"
      puts "Run `git push` to sync changes."
      exit
    end
  end

  %w[start stop restart].each do |command|
    desc "#{command} Unicorn server."
    task command do
      on roles(:app) do
        execute "/etc/init.d/unicorn_#{fetch(:application)} #{command}"
      end
    end
  end
  
  before :deploy, "deploy:check_revision"  
  after :deploy, "deploy:restart"
  after :rollback, "deploy:restart"

end
```

Below is my `deploy.rb` file:

``` ruby deploy.rb
lock '3.2.1'

set :application, 'phindee'
set :repo_url, 'git@github.com:vladigleba/phindee.git'

set :deploy_to, "/var/www/#{fetch(:application}"
set :deploy_user, "bob"

set :rbenv_type, :user 
set :rbenv_ruby, '2.1.0'
set :rbenv_prefix, "RBENV_ROOT=#{fetch(:rbenv_path)} RBENV_VERSION=#{fetch(:rbenv_ruby)} #{fetch(:rbenv_path)}/bin/rbenv exec"
set :rbenv_map_bins, %w{rake gem bundle ruby rails}
set :rbenv_roles, :all

set :linked_files, %w{config/database.yml config/application.yml}
set :linked_dirs, %w{bin log tmp/pids tmp/cache tmp/sockets vendor/bundle public/system}

set :keep_releases, 5
```

and here's my `deploy/production.rb` file:

``` ruby production.rb
set :stage, :production
set :rails_env, :production

server "#{fetch(:deploy_user)}@123.123.123.123:12345", roles: %w{web app db}, primary: true
```

I won't be explaining the Capistrano code here because that's already covered in parts [5]({{ root_url }}/blog/2014/04/04/deploying-rails-apps-part-5-configuring-capistrano/) and [6]({{ root_url }}/blog/2014/04/10/deploying-rails-apps-part-6-writing-capistrano-tasks/) of my "Deploying Rails Apps" series, so be sure to check that out if you're new to Capistrano or just need some clarification.

It's worth noting that Chef actually has a [`deploy`](http://docs.getchef.com/chef/resources.html#deploy) resource that's modeled after Capistrano, but I didn't have time to learn how to implement my existing Capistrano recipes with it. If you're interested though, feel free to give it a try.

load APP NAME, USER, IP, and PORT from yaml file?

