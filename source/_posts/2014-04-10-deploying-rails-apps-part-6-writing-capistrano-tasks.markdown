---
layout: post
title: "Deploying Rails Apps, Part 6: Writing Capistrano Tasks"
date: 2014-04-10 08:42
comments: true
categories: [Deployment, Phindee, Deployment Series]
description: Learn how to write Capistrano tasks to help you automate your deployment.
---

It’s been a long time coming, but we finally reached the point where we can deploy our app to our VPS and have it be available on the internet for viewing. We configured Capistrano in the [previous post]({{ root_url }}/blog/2014/04/04/deploying-rails-apps-part-5-configuring-capistrano/), and now we’ll actually use it for the deploy. Just like in the previous posts, I’ll be going over how I have things setup for [Phindee](http://phindee.com/) to help illustrate the concepts.

<!-- more -->

You might already know this, but Capistrano does much of its work with the help of tasks. When we previously ran `cap install`, we actually invoked a task named `install` that created various files and directories; if you’re interested, you can see its code [on GitHub](https://github.com/capistrano/capistrano/blob/master/lib/capistrano/tasks/install.rake). Similarly, we can write our own tasks to help us automate various things.

When I was deploying Phindee, I created a file called `setup.rake` inside the app’s local `/lib/capistrano/tasks` directory. Go ahead and do the same for your app, and add the following code into it:

``` ruby setup.rake
namespace :setup do

  desc "Upload database.yml file."
  task :upload_yml do
    on roles(:app) do
      execute "mkdir -p #{shared_path}/config"
      upload! StringIO.new(File.read("config/database.yml")), "#{shared_path}/config/database.yml"
    end
  end

  desc "Seed the database."
  task :seed_db do
    on roles(:app) do
      within "#{current_path}" do
        with rails_env: :production do
          execute :rake, "db:seed"
        end
      end
    end
  end

  desc "Symlinks config files for Nginx and Unicorn."
  task :symlink_config do
    on roles(:app) do
      execute "rm -f /etc/nginx/sites-enabled/default"

      execute "ln -nfs #{current_path}/config/nginx.conf /etc/nginx/sites-enabled/#{fetch(:application)}"
      execute "ln -nfs #{current_path}/config/unicorn_init.sh /etc/init.d/unicorn_#{fetch(:application)}"
   end
  end

end
```

The first thing you’ll notice is we’re organizing all of the tasks here under a namespace called `:setup`. It’s not strictly necessary, but I just like to keep things organized. If the code seems overwhelming, don’t worry&mdash;I’ll explain everything.

# Uploading Database Info

We’ll get a feel for how tasks work and what they’re capable of doing by running the first task in this file, which will simply upload our `database.yml` file to our server. But before we run it, we first need to add `database.yml` to our `.gitignore` file to let Git know we don’t want it tracked and uploaded to GitHub from now on. Why? Because we’ll be adding our database password into it, and it’s generally not a good idea to upload passwords to your GitHub repository. Below is how my `.gitignore` file looks like (it's usually located in your app's root directory, but if it's not there, go ahead and create it):

``` text .gitignore
# Ignore bundler config.
/.bundle

# Ignore the default SQLite database.
/db/*.sqlite3
/db/*.sqlite3-journal

# Ignore log, doc, and tmp directories
/log/*.log
/tmp
/doc

# Ignore .DS_Store files on Mac
.DS_Store

# Ignore database.yml file to prevent password leakage
/config/database.yml
```

You can see that in addition to ignoring the `database.yml` file, I’m also ignoring lots of other files as well, especially the annoying `.DS_Store` files that the Mac OS loves to create.

With that out of the way, we can now safely open up `database.yml` and add our database parameters to the file's production section. We’ll only need to modify the `database`, `username`, and `password` keys, and everything else can be left the way it is. Make sure you set these to the database name, username, and password you created in [part 2]({{ root_url }}/blog/2014/03/14/deploying-rails-apps-part-2-setting-up-the-server/).

Then run the following command inside your app’s local root directory:

``` bash
cap production setup:upload_yml
```

This tells Capistrano to execute the `upload_yml` task inside the `setup` namespace using the `production.rb` file configurations. (If we had the `stage.rb` file setup, we could’ve ran `cap stage setup:upload_yml` to execute this task on our staging environment instead.) We can verify that the command uploaded the `database.yml` file to our server by logging in and outputting the contents of the file:

``` bash
cat /var/www/phindee/shared/config/database.yml
```

This is obviously a trivial task, but it shows how powerful Capistrano can be. A few keystrokes allowed us to create a specific directory structure on our server and upload a file from our local computer. Neat stuff&mdash;and it will only get better.

All right, let’s now switch gears and learn about the syntax that made all of this possible.

# Understanding SSHKit

Capistrano 3 uses the Rake DSL (Domain Specific Language), which means if you ever wrote Rake tasks, you'll be in familiar territory when writing Capistrano tasks; the only new thing you'll need to learn about is SSHKit and the various methods it provides. [SSHKit](https://github.com/capistrano/sshkit) was actually developed and released with Capistrano 3, and it’s basically a lower-level tool that provides methods for connecting and interacting with remote servers; it does all the heavy lifting for Capistrano, in other words. There are four main methods you need to know about:

- `on()`: specifies the server to run on
- `within()`: specifies the directory path to run in
- `as()`: specifies the user to run as
- `with()`: specifies the environment variables to run with

Typically, you’ll start a task by using an `on()` method to specify the server on which you want your commands to run. Then you can use any combination of `as()`, `within()`, and `with()` methods, which are repeatable and stackable in any order, to provide additional details. For example, the `upload_yml` task we ran in `setup.rake` uses the `on()` method to specify that the resulting block of code should only be run on the application server. The `seed_db` task right below it has *three* parameters that specify how the resulting statement will run; it uses `on()`, `within()`, and `with()` to specify that the statement should only run *on* the application server, *within* the path specified, and *with* certain environment variables set.

Obviously, if SSHKit gives you methods to specify certain parameters that must be met before the actual statements are run, it should also give you methods to help you run those statements. That’s exactly what it does, and below are those methods:

- `execute()`: the workhorse that runs the commands on your server
- `upload()`: uploads a file from your local computer to your remote server
- `capture()`: executes a command and returns its output as a string
- `puts()`: writes the output returned by `capture()` to the screen
- `background()`: runs a command in the background
- `test()`: can be used for control flow since it works like the `test` command-line utility in Unix and returns false if its expression exits with a non-zero value

Armed with this knowledge, we’re now better equipped to understand the three tasks in `setup.rake`.

# Task Walk-Through

The `upload_yml` task, for example, is run on the application server only, and its first statement uses the `execute()` method to run `mkdir -p`, which creates the following directory structure inside `/var`, if it doesn’t already exist:

    ├── www
      └── phindee
        └── shared
          └── config

The `shared_path` variable evaluates to `/var/www/phindee/shared`, since it takes the path we specified in `deploy_to` and appends the `/shared` directory to the end of it ([see the code](https://github.com/capistrano/capistrano/blob/aeab6b6a1e5c5e654f35321dcd7438a0659864d0/lib/capistrano/dsl/paths.rb#L60)). We then append the `/config` directory to the end of that.

The next statement uses `upload()` to upload our `database.yml` file to the directory we just created above. `File.read()` returns the file's contents as a string, which `StringIO.new()` takes and turns into a file. We then use this file as our source and `#{shared_path}/config/database.yml` as our destination. By the way, `upload()` has the bang symbol (!) because that’s how it’s defined in SSHKit, and it's just a convention letting us know that the method will block until it finishes.

The `seed_db` task does exactly what it says&mdash;seeds the database with data by running `rake db:seed`. The `current_path` variable takes the `deploy_to` path and appends `/current` to it, which will result in `/var/www/phindee/current`. This is where the seed statement will run on the application server with the `rails_env` variable set to `:production`.

But in order to ensure `rake` runs with the proper environment variables set, we have to use `rake` as a symbol and pass `db:seed` as a string; otherwise, the environment variables won't be set. This format will also be necessary whenever you’re running any other Rails-specific commands that rely on certain environment variables being set (see [this section](https://github.com/capistrano/sshkit#the-command-map) of the SSHKit README to learn more).

The final `:symlink_config` task does a couple ofthings. First, it removes the default configuration file for Nginx (`/etc/nginx/sites-enabled/default`) and replaces it with a symlink to our own configuration file (`nginx.conf`). Then it also creates a symlink to our `unicorn_init.sh` script that helps us manage Unicorn, but this time inside `/etc/init.d`, which is the place where Ubuntu stores scripts for managing various services (a similar script for managing Nginx was already added there when we ran `apt-get`). Notice we’re using `fetch()` in both cases, which simply retrieves the value of a variable initialized by `set()`, to name our files after our application name.

These three tasks just merely scratch the surface of what’s possible, however. I recommend you take a look at SSHKit’s [example page](https://github.com/capistrano/sshkit/blob/master/EXAMPLES.md) to learn more; I found it to be an invaluable tool in helping me better understand how all the different methods work together.

# Finishing Touches

We’re almost ready for our deploy. There’s just one more file we need to add to `/lib/capistrano/tasks` called `deploy.rake`. Below is the code I have in mine:

``` ruby deploy.rake
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

end
```

The `check_revision` task checks to make sure we pushed all our local changes to the remote master branch; if it finds that our local code is out of sync with the remote, the `exit` statement will cause Capistrano to quit. We'll want to run this task *before* Capistrano runs its own `deploy` task to make sure we don’t forget to push our local changes up to GitHub when trying to deploy.

The second block of code actually creates *three* separate tasks that will allow us to start, stop, and restart Unicorn from our local computer. We'll run the `restart` task, for example, after Capistrano finishes its deploy so Unicorn picks up the new code. (Note that I created a namespace called `deploy` to contain these tasks since that's what they're related to.)

But how do we tell Capistrano to run these tasks as part of its deploy? Well, Capistrano provides two callback functions called `before()` and `after()` to help us out, and the code below illustrates how it's done (add it to the end of your `deploy.rake` file):

``` ruby deploy.rake
namespace :deploy do

  . . .

  before :deploy, "deploy:check_revision"
  after :deploy, "deploy:restart"
  after :rollback, "deploy:restart"
end
```

We're first using `before()` to tell Capistrano to run our `check_revision` task before it runs its own `deploy` task. Then we use `after()` to make sure Capistrano restarts Unicorn after a `deploy`. Finally, we do the same thing after a `rollback` task, which is a task that simply allows you to rollback to the previous deploy if you don't like the current one, for whatever reason, and it's invoked by running `cap production deploy:rollback`. Of course, we could use these callbacks with *any* task to run *any other* task, and this is powerful because it allows us to reuse and extend our code in different ways.

I'd like to point out that we're using the callbacks inside a namespace to make sure Capistrano knows which tasks the callbacks are referencing. This way Capistrano will know to run the `deploy` task, for example, that's defined in its own `deploy` namespace, and not some other task with an identical name defined somewhere else.

What we now have is our own custom recipe (a Capistrano term meaning a series of tasks) for deployment. You can similarly write multiple other recipes to help you automate any other tedious work you find yourself doing over and over again.

All right, having all the necessary tasks defined, we can go ahead and push our code up to GitHub so Capistrano can deploy the latest changes:

``` bash
git add .
git commit -m "message"
git push origin master
```

We’re now ready to deploy.

# Show Time

This is a moment that was a long time coming. Let’s see what happens:

``` bash
cap production deploy
```

It's likely that you encountered some type of error before the task was able to finish. This is normal&mdash;something always goes wrong the first time you deploy (if everything went smoothly, on the other hand, you deserve a place in the Capistrano hall of fame). Capistrano configurations are specific to your setup/environment, and what worked for me may not necessarily work for you. The best advice I can give is to google the specific problem you’re having, and it’s likely you'll find someone who struggled with the same thing and already provided a possible solution for you.

## Breaking It Down

A lot of things happened when we ran `cap production deploy`. If you do an `ls` on your `deploy_to` directory, for example, you’ll find four new directories there:

- `/releases`: whenever you deploy, a new directory will be created here containing all the code for that deploy
- `/current`: a symlink pointing to the latest directory in `/releases`
- `/shared`: holds files and directories that persist throughout deploys
- `/repo`: contains a clone of your `.git` repo

With regards to the directories in `/shared`, the main ones you need to know about are:

- `/config`: contains our `database.yml` file
- `/log`: contains the `production.log` and `unicorn.log` files (see `/var/log/nginx/error.log` for the Nginx log file)
- `/public/assets`: contains all your assets
- `/tmp/pids`: will contain a `unicorn.pid` file that stores the process ID of Unicorn’s master process (when it's running)

When you run `cap production deploy`, you’re actually calling a Capistrano task called `deploy`, which then sequentially invokes other tasks. The main ones are listed below:

1. `starting`: creates the directory structure and checks that the GitHub repository is reachable
2. `updating`: copies the GitHub repository to a new `/releases` directory, adds symlinks pointing to `/shared`, runs Bundler, runs migrations, and compiles assets
3. `publishing`: symlinks the `/current` directory to the new `/releases` directory
4. `finishing`: removes old `/releases` directories

If you run `cap -T`, you’ll see all these tasks listed, along with some other tasks that Capistrano runs during a deploy (see the [documentation](http://capistranorb.com/documentation/getting-started/flow/) to learn when they're run). The tasks we defined ourselves will also be listed there, along with their descriptions.

Now that our code is deployed, we can run the two other tasks in `deploy.rb`. If you have a seed file for seeding your database, you can run `cap production setup:seed_db` to invoke it; otherwise, you'll need to run `cap production setup:symlink_config` to symlink your config files.

# Wrapping Up

One last thing we have left to do is add our symlinked Unicorn script (the one in `/etc/init.d`) to Ubunut’s startup scripts to make sure Unicorn will automatically start up whenever we restart our VPS. We can do this easily using the `update-rc.d` utility; we just need to give it a name of a file in `/etc/init.d`, and it'll automatically add it to the correct startup folders. Below is the command that does this (be sure to change `unicorn_phindee` to the name of your own script):

``` bash
sudo update-rc.d unicorn_phindee defaults
```

This was already done automatically, by the way, for Nginx and PostgreSQL when we installed them with `apt-get` in part 2, which means that whenever we restart our VPS, these services will be restarted automatically as well.

Once that’s done, I’ll log in to my VPS and restart Nginx (so it picks up the `nginx.conf` file we symlinked). Then I’ll start Unicorn by calling `start` on the `unicorn_phindee` script (be sure to use your own file name):

``` bash
sudo service nginx restart
/etc/init.d/unicorn_phindee start
```

If you now open up your favorite browser (I hope it's not Internet Explorer) and type your server’s IP address into the address bar, you might see your app; if you you don't, don't worry. Deployment is hard and takes a while to sink in. If things aren’t working, your best bet is to start with the logs and google any errors you find there.

But the most important thing is to not get discouraged. When I set up my production server from scratch for the very first time, it took me a *full week* (I’m not kidding) to get it working. It was frustrating, discouraging, and is the reason why I decided to write this series, because I didn’t want other people going through the same thing. It doesn't have be that way though, and I hope it won't be.

(If you enjoyed this series, you might also like the ["Provisioning a Rails Server Using Chef" series]({{ root_url }}/blog/topics/chef-series/), which explains how you can use Chef to automate your entire server setup.)
