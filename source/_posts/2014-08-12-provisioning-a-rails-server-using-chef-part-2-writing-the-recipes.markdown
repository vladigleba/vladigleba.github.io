---
layout: post
title: "Provisioning a Rails Server Using Chef, Part 2: Writing the Recipes"
date: 2014-08-12 09:29
comments: true
categories: [Server Provisioning, Phindee, Chef Series]
description: Learn how to write recipes in Chef to provision a Rails server and install Node.js, PostgreSQL, rbenv, Ruby, Redis, and Nginx.
---

In [part 1]({{ root_url }}/blog/2014/07/28/provisioning-a-rails-server-using-chef-part-1-introduction-to-chef-solo/), we learned about Chef Solo and used it to create a standard Chef directory structure, along with our own cookbook. Now it's time to start writing the recipes we will run to provision our Rails server and install Node.js, PostgreSQL, rbenv, Ruby, Redis, and Nginx.

<!-- more -->

# Defining Default Values

The first thing we'll do is define some default values for our recipes. Go ahead and create a new file called `default.rb` inside the `/attributes` directory of the cookbook you created in part 1, and add the following code into it:

``` ruby default.rb
default['app']               = 'phindee'

default['nodejs']['dir']     = '/usr/local'
default['nodejs']['version'] = '0.10.29'

default['ruby']['version']   = '2.1.2'
default['redis']['version']  = '2.8.13'
```

These are called attributes, and they're just variables that are later used in recipes. We're defining simple things here like the app name, the directory where Node.js will be installed, and the versions of the software we'll be installing. Storing such things in a single file makes it easy to modify them later on.

This file is great for storing attributes that will be shared with more than one server, but attributes that are server-specific, like ports, usernames, and passwords, will be stored in another JSON file outside our cookbook. If you followed part 1, your cookbook is stored in your app's `/config/chef/site-cookbooks` directory, but this JSON file will reside inside the `/config/chef/nodes` directory, and it'll be named after the IP address of the server you'll be provisioning (for example, `123.123.123.123.json`).

Go ahead and create the file now, and add the following code into it (be sure to replace the attributes with your own):

``` json 123.123.123.123.json
{ 
  "group": "foobars",
  "port": 12345,
  
  "user": {
    "name": "bob",
    "password": "password-shadow-hash"
  },
  
  "db": {
    "root_password": "secret",
    "user": {
      "name": "bob",
      "password": "secret"
    }
  }
}
```

Due to the sensitive nature of this file, it's best to add it to your `.gitignore` file so it doesn't get uploaded to GitHub. Here's the line you'll need to add:

``` text .gitignore
/config/chef/nodes/123.123.123.123.json
```

One thing I'd like to point out is Chef doesn't use plain text passwords when creating new users. Instead, it uses a [shadow hash](http://en.wikipedia.org/wiki/Passwd#Shadow_file) of the plain text password, so the `user.password` attribute must be a shadow hash. If you have the `openssl` command installed on your local computer, you can create a password shadow hash by running the following:

``` bash
openssl passwd -1 "theplaintextpassword"
```

This just uses the `passwd` command provided by `openssl` to create an MD5-based hash of the password (specified by the `-1` flag). You can then copy and paste the string that the command returns into the JSON file above. Once the user is set up on our node, you'll still use the plain text password to log in, just like always. I wasn't able to get shadow hash passwords working with PostgreSQL though, which is why I'm just using the plain text password there, but feel free to leave a comment if you know how to make it work.

One last thing I want to mention is that if you have the same attribute defined in both `default.rb` and the JSON file, the latter will always override the former.

# Writing Recipes

Now that the attributes are defined, we're ready to start writing the recipes themselves. These recipes do the exact same server setup as the one covered in the ["Deploying Rails Apps" series]({{ root_url }}/blog/topics/deployment-series/), so I won't be explaining the whys behind the things I do here since that's already covered in the series itself. If you've never provisioned a server from scratch before, it's best to read that series first before continuing.

## The First One

Our first recipe will install various packages and set the correct time zone. Create a new file called `default.rb` inside the `/recipes` directory of your cookbook, and add the following code into it:

``` ruby default.rb
# update package database
execute "apt-get update"

# install packages
package "telnet"
package "postfix"
package "curl"
package "git-core"
package "zlib1g-dev"
package "libssl-dev"
package "libreadline-dev"
package "libyaml-dev"
package "libsqlite3-dev"
package "sqlite3"
package "libxml2-dev"
package "libxslt1-dev"
package "libpq-dev"
package "build-essential"
package "tree"

# set timezone
bash "set timezone" do
  code <<-EOH
    echo 'US/Pacific-New' > /etc/timezone
    dpkg-reconfigure -f noninteractive tzdata
  EOH
  not_if "date | grep -q 'PDT\|PST'"
end
```

Chef uses a domain-specific language (DSL) for writing recipes, and the code above is what it looks like. A recipe is made up of resources, and a resource is simply an abstraction of some shell code you would run to provision your server that Chef already implemented for you and wrapped it in a resource. Chef provides most of the resources you will need, but you can also write your own.

In the file above, we're using three resources: [`execute`](http://docs.getchef.com/chef/resources.html#execute), [`package`](http://docs.getchef.com/chef/resources.html#package), and [`bash`](http://docs.getchef.com/chef/resources.html#bash). The `execute` resource executes a command, the `package` resource manages packages, and the `bash` resource executes scripts using the Bash interpreter. So in the code above, we're first using `execute` to run `apt-get update` to fetch the latest updates for the packages on our node. (A server is known as a node in Chef terminology.) Next, we use `package` to install the various packages our node will need, and finally, we use `bash` to execute two lines of code that will set the correct time zone (be sure to modify the `echo` command so it sets your own time zone).

Each resource has various attributes that you can optionally specify inside a `do...end` block. For example, with the `bash` resource, we're using the `code` attribute to specify the code that will run to set the timezone (see the [documentation](http://docs.getchef.com/chef/resources.html#bash) to learn about the other attributes it supports). This resource is similar to the `execute` resource, which also runs commands, but `execute` is used to run a single command, while `bash`'s `code` attribute is used to run more than one.

We could've specified attributes for the `execute` and `package` resources as well, but there is no need in this case. For example, this

``` ruby
execute "update packages" do
  command "apt-get update"
end
```

is equivalent to `execute "apt-get update"`. The only difference between the two is the longer version gives the resource block a name&mdash;"update packages" in this case, but it could've been anything&mdash;while the shorter version just specifies the command to execute. When the `command` attribute is missing, the resource name is the command that is executed, and that's why the shorter version works just as well.

One last interesting thing about the `bash` resource is the `not_if` line. This is called a [guard attribute](http://docs.getchef.com/chef/resources.html#guards), and it can be applied to any resource, not just `bash`. It's used to prevent a resource from running if certain conditions are met. In this case, I'm specifying a command that will output the current date and search for either the word "PDT" (Pacific Daylight Time) or "PST" (Pacific Standard Time) to see if the correct time zone is set (be sure to modify this for your own time zone). The guard will be applied and the resource won't run if the command returns `0`, which is the case with `grep` when it finds a match.

## Working with Users

This next recipe will create a new user and group. Add a new file called `users.rb` to the directory containing the previous recipe, and fill it with the following:

``` ruby users.rb
# create group
group node['group']

# create user and add to group
user node['user']['name'] do
  gid node['group']
  home "/home/#{node['user']['name']}"
  password node['user']['password']
  shell "/bin/bash"
  supports manage_home: true # need for /home creation
end

# give group sudo privileges
bash "give group sudo privileges" do
  code <<-EOH
    sed -i '/%#{node['group']}.*/d' /etc/sudoers
    echo '%#{node['group']} ALL=(ALL) ALL' >> /etc/sudoers
  EOH
  not_if "grep -xq '%#{node['group']} ALL=(ALL) ALL' /etc/sudoers"
end
```

Here we're first using the [`group` resource](http://docs.getchef.com/chef/resources.html#group) to create a new group whose name will come from the `group` attribute defined in the JSON file we created earlier. Note the syntax to access that attribute; it stays the same whether you're accessing attributes from the JSON file or the `default.rb` file.

Next, we use the [`user` resource](http://docs.getchef.com/chef/resources.html#user) to create a new user whose name is also defined in the JSON file. But now it gets interesting because there are a handful of additional attributes we're using:

- `gid` assigns this user to the group we created right before
- `home` specifies the location of the user's home directory
- `password` accepts a shadow hash of the users password
- `shell` specifies the login shell that the user will log in with (user won't have login access without this attribute)
- `supports` sets `manage_home` to `true` to tell Chef to create the home directory when the user is created

The last `bash` resource adds a line to the `sudoers` file that gives the group `sudo` privileges, but it does this only if the line isn't already there.

# Restricting SSH Access

The next thing on our list is restricting SSH access to our node. Add the following code into a new file called `ssh.rb`:

``` ruby ssh.rb
# tell chef about ssh service
service 'ssh' do
  provider Chef::Provider::Service::Upstart
  supports [:status, :restart]
end

# modify port
bash "modify port" do
  code <<-EOH
    sed -i '/Port.*/d' /etc/ssh/sshd_config
    echo 'Port #{node['port']}' >> /etc/ssh/sshd_config
  EOH
  notifies :restart, "service[ssh]", :delayed
  not_if "grep -xq 'Port #{node['port']}' /etc/ssh/sshd_config"
end

# disable root login
bash "disable root login" do
  code <<-EOH
    sed -i '/PermitRootLogin.*/d' /etc/ssh/sshd_config
    echo 'PermitRootLogin no' >> /etc/ssh/sshd_config
  EOH
  notifies :restart, "service[ssh]", :delayed
  not_if "grep -xq 'PermitRootLogin no' /etc/ssh/sshd_config"
end

# restrict login only to created user
bash "restrict login only to created user" do
  code <<-EOH
    sed -i '/AllowUsers.*/d' /etc/ssh/sshd_config
    echo 'AllowUsers #{node['user']['name']}' >> /etc/ssh/sshd_config
  EOH
  notifies :restart, "service[ssh]", :delayed
  not_if "grep -xq 'AllowUsers #{node['user']['name']}' /etc/ssh/sshd_config"
end

# disable dns
bash "disable dns" do
  code <<-EOH
    sed -i '/UseDNS.*/d' /etc/ssh/sshd_config
    echo 'UseDNS no' >> /etc/ssh/sshd_config
  EOH
  notifies :restart, "service[ssh]", :delayed
  not_if "grep -xq 'UseDNS no' /etc/ssh/sshd_config"
end
```

Chef has a [`service` resource](http://docs.getchef.com/chef/resources.html#service) designed for managing services like SSH. We tell it to manage SSH by specifying "ssh" as the resource name, and since we don't have a `service_name` attribute listed, Chef automatically assumes that the resource name is also the name of the service we want to manage.

We then use the `provider` attribute to tell Chef to use [upstart](https://en.wikipedia.org/wiki/Upstart) to manage the service. This is necessary whenever there are two or more ways available for managing a service, which is the case with SSH on the node I'm running. My node has an upstart job (located in `/etc/init`) and a traditional init script (located in `/etc/init.d`) for managing SSH, and I decided to go with upstart since it's superior, but either will work for our purposes. If there is only one service provider available, Chef will detect it automatically, and there is no need for the `provider` attribute.

By default, Chef inspects the process table to see if a service is running, but it's also possible to use the `service ssh status` command (which is more reliable) to do the same thing. That's why we use the `supports` attribute to tell Chef to use the `status` command instead. And while we're at it, we also give Chef permission to use the `restart` command to restart SSH.

Once the service is defined, we use the `bash` resource to modify the SSH port, disable `root` login, restrict login access just to our created user, and disable DNS lookup. Each `bash` block also uses the [`notifies` attribute](http://docs.getchef.com/chef/resources.html#notifications) to tell the SSH `service` resource we just defined to restart itself <em>if</em> the code inside the `code` attribute actually runs. But we use the `delayed` timer to tell Chef to queue up the notification and run in at the very end. The other option is to use the `immediate` timer to do the restart immediately, but we don't want to restart the service four separate times when we can just wait till the end and do it just once.

And just like in the two previous recipes, we use the `not_if` guard to make  sure the `bash` resources don't run if the necessary changes are already made.

## Installing Node.js

Next order of business is installing Node.js. Add the following code into a new file called `nodejs.rb`:

``` ruby nodejs.rb
# variables for node.js
arch = node['kernel']['machine'] =~ /x86_64/ ? "x64" : "x86"
package_stub = "node-v#{node['nodejs']['version']}-linux-#{arch}"
nodejs_tar = "#{package_stub}.tar.gz"
nodejs_url = "http://nodejs.org/dist/v#{node['nodejs']['version']}/#{nodejs_tar}"
executable = "#{node['nodejs']['dir']}/bin/node"

# download tar file
remote_file "/usr/local/src/#{nodejs_tar}" do
  source nodejs_url
  mode 0644
  action :create_if_missing
end

# install node.js from binaries
execute "install node.js" do
  command <<-EOF
    tar xf /usr/local/src/#{nodejs_tar} \
    --strip-components=1 --no-same-owner \
    -C #{node['nodejs']['dir']} \
    #{package_stub}/bin \
    #{package_stub}/lib \
    #{package_stub}/share
  EOF
  not_if { File.exists?(executable) && `#{node['nodejs']['dir']}/bin/node --version`.chomp == "v#{node['nodejs']['version']}" }
end
```

The very first line makes use of [Ohai](http://docs.getchef.com/ohai.html), a tool Chef uses to detect attributes on a node and make them available for use in recipes. We're extracting the type of architecture our node is running on to make sure we download the correct tar file for installing Node.js.

We download the tar file using a resource called [`remote_file`](http://docs.getchef.com/chef/resources.html#remote-file), and we then use the `source` attribute to specify the source of the tar file, `mode` to specify its mode, and `action` to tell Chef to create the file only if it's not already there.

One interesting thing about the `action` attribute is it's actually present in each resource we write, whether we explicitly assign one or not. Not every resource has the same actions though. `remote_file`, for example, has `create`, `create_if_missing`, `delete`, and `touch` actions, while `bash` only has `run` and `nothing` actions. But every resource is assigned a default action, if we don't assign one ourselves (the resource's documentation will specify which action is assigned by default).

After the file is downloaded, we use `execute` to do the install. One interesting thing about this resource is the `not_if` guard, which executes some Ruby code, whereas the previous one only executed shell commands. Guards  can run a shell command specified inside a string, or Ruby code specified inside a block. Ruby code must return either `true` or `false`, while shell commands can return any value, but the guard runs only if a zero is returned (see the [documentation](http://docs.getchef.com/chef/resources.html#guards)). 

So in the code above, we're first executing some Ruby code to determine if a file exists, and then we execute a shell command to output the Node.js version we installed, but this output is processed by Ruby and gets compared with the version we've specified in our attributes file. As a result, Node.js won't be installed if there is a Node.js executable already present on the node that returns the correct version number. (Note that shell commands will be processed by Ruby only if they're specified using backquotes).

## Installing PostgreSQL

Our next recipe will install PostgreSQL. Create a new file called `postgres.rb`, and add the following code into it:

``` ruby postgres.rb
package "postgresql"
package "postgresql-contrib"

# change postgres password
execute "change postgres password" do
  user "postgres"
  command "psql -c \"alter user postgres with password '#{node['db']['root_password']}';\""
end

# create new postgres user
execute "create new postgres user" do
  user "postgres"
  command "psql -c \"create user #{node['db']['user']['name']} with password '#{node['db']['user']['password']}';\""
  not_if { `sudo -u postgres psql -tAc \"SELECT * FROM pg_roles WHERE rolname='admin'\" | wc -l`.chomp == "1" }
end

# create new postgres database
execute "create new postgres database" do
  user "postgres"
  command "psql -c \"create database #{node['app']} owner #{node['db']['user']['name']};\""
  not_if { `sudo -u postgres psql -tAc \"SELECT * FROM pg_database WHERE datname='#{node['app']}'\" | wc -l`.chomp == "1" }
end
```

This recipe is fairly straightforward. We install Postgres using the `package` resource and use `execute` to modify the `postgres` user's password. We also create new user, along with a new database, which is assigned to the newly created user. (Note that we're using the `user` attribute to execute these commands as the `postgres` user, which is necessary because otherwise Postgres would run these commands as `root`, and such a user does not exist in Postgres by default.)

## Installing rbenv and Ruby

It's now time to install rbenv and Ruby. Add the following code into a new file called `rbenv.rb`:

``` ruby rbenv.rb
# create .bash_profile file
cookbook_file "/home/#{node['user']['name']}/.bash_profile" do
  source "bash_profile"
  mode 0644
  owner node['user']['name']
  group node['group']
end

# install rbenv
bash 'install rbenv' do
  user node['user']['name']
  cwd "/home/#{node['user']['name']}"
  code <<-EOH
    export HOME=/home/#{node['user']['name']}
    curl -L https://raw.github.com/fesplugas/rbenv-installer/master/bin/rbenv-installer | bash
  EOH
  not_if { File.exists?("/home/#{node['user']['name']}/.rbenv/bin/rbenv") }
end

# install ruby
version_path = "/home/#{node['user']['name']}/.rbenv/version"
bash 'install ruby' do
  user node['user']['name']
  cwd "/home/#{node['user']['name']}"
  code <<-EOH
    export HOME=/home/#{node['user']['name']}
    export RBENV_ROOT="${HOME}/.rbenv"
    export PATH="${RBENV_ROOT}/bin:${PATH}"
    rbenv init -

    rbenv install #{node['ruby']['version']}
    rbenv global #{node['ruby']['version']}
    echo 'gem: -–no-ri -–no-rdoc' > .gemrc
    .rbenv/bin/rbenv exec gem install bundler
    rbenv rehash
  EOH
  not_if { File.exists?(version_path) && `cat #{version_path}`.chomp.split[0] == node['ruby']['version'] }
end
```

We're using a new resource here called [`cookbook_file`](http://docs.getchef.com/chef/resources.html#cookbook-file), which takes a file in our recipe and copies it to a specific location on our node. The file were creating is called `bash_profile`, and it contains some code that allows rbenv to initialize itself properly (store it in your cookbook's `/files/default` directory):

``` bash bash_profile
export RBENV_ROOT="${HOME}/.rbenv"

if [ -d "${RBENV_ROOT}" ]; then
  export PATH="${RBENV_ROOT}/bin:${PATH}"
  eval "$(rbenv init -)"
fi
```

If you go back to the `cookbook_file` resource, you'll see that we're copying the file to the user's home directory (since we did not specify a `path` attribute, the resource's name is also the path to the location where it will be stored), and we're using the `mode`, `owner`, and `group` attributes to set the file's mode, owner, and group, respectively.

Afterwards, we're using `bash` to install rbenv. Because we're not doing a system-wide install, we run the rbnev installer under the user we created earlier, and we use the `cwd` attribute to run the install inside the user's home directory. Once that's done, the last `bash` block then uses rbenv to install Ruby itself.

## Installing Redis

Next in line is Redis, so go ahead and create a new file called `redis.rb`:

``` ruby redis.rb
package "tcl8.5"

# download redis
remote_file "/home/#{node['user']['name']}/redis-#{node['redis']['version']}.tar.gz" do
  source "http://download.redis.io/releases/redis-#{node['redis']['version']}.tar.gz"
  mode 0644
  action :create_if_missing
end

# install redis
bash 'install redis' do
  cwd "/home/#{node['user']['name']}"
  code <<-EOH
    tar xzf redis-#{node['redis']['version']}.tar.gz
    cd redis-#{node['redis']['version']}
    make && make install
  EOH
  not_if { File.exists?("/usr/local/bin/redis-server") &&
           `redis-server --version`.chomp.split[2] == "v=#{node['redis']['version']}" }
end

# install redis server
execute "curl -L https://gist.githubusercontent.com/vladigleba/28f4f6b4454947c5223e/raw | sh" do
  cwd "/home/#{node['user']['name']}/redis-#{node['redis']['version']}/utils"
  not_if "ls /etc/init.d | grep redis"
end
```

This recipe doesn't contain any new Chef concepts. It simply downloads Redis using the `remote_file` resource, installs it using the `bash` resource, and installs the Redis server with the `execute` resource.

## Installing Nginx

The last thing left to install is Nginx, and here's the code that will go in a new `nginx.rb` file to do just that:

``` ruby nginx.rb
package "nginx"

# remove default nginx config
default_path = "/etc/nginx/sites-enabled/default"
execute "rm -f #{default_path}" do
  only_if { File.exists?(default_path) }
end

# start nginx
service "nginx" do
  supports [:status, :restart]
  action :start
end

# set custom nginx config
template "/etc/nginx/sites-enabled/#{node['app']}" do
  source "nginx.conf.erb"
  mode 0644
  owner node['user']['name']
  group node['group']
  notifies :restart, "service[nginx]", :delayed
end
```

There is only one new Chef concept here, and that's the [`template` resource](http://docs.getchef.com/chef/resources.html#template). It's similar to the `cookbook_file` resource in that it copies a file from a cookbook to a location on a node, but it also does much more than that; it allows you to modify the contents of the file by embedding Ruby code into it using ERB (Embedded Ruby) templates, just like you would if you wrote Ruby on Rails views in ERB. All the attributes that are accessible in your recipes are also accessible in template files, and when you combine this with the usual ERB features like conditional statements and blocks, you'll be able to customize your files in any way you want.

Templates are stored in your cookbook's `/templates` directory, so go ahead and create a new file there called `nginx.conf.erb` with the following code (note that the syntax for accessing attributes doesn't change):

``` erb nginx.conf.erb
upstream unicorn {
  server unix:/tmp/unicorn.<%= node['app'] %>.sock fail_timeout=0;
}

server {
  server_name www.<%= node['app'] %>.com;
  return 301 $scheme://<%= node['app'] %>.com$request_uri;
}

server {
  listen 80 default deferred;
  server_name <%= node['app'] %>.com;
  root /var/www/<%= node['app'] %>/current/public;
  
  location ^~ /assets/ {
    gzip_static on;
    expires max;
    add_header Cache-Control public;
  }
  
  try_files $uri/index.html $uri @unicorn;
  location @unicorn {
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $http_host;
    proxy_redirect off;
    proxy_pass http://unicorn;
  }
  
  error_page 500 502 503 504 /500.html;
  keepalive_timeout 5;
}
```

This is the file we're referencing inside the `template` resource in `nginx.rb`. You'll notice the attributes we specify there are very similar to those specified in the `cookbook_file` resources we wrote earlier. But one thing that's different is we're also using the `notifies` attribute to call `restart` on the previously defined Nginx service, which allows the new configuration file to be loaded in.

## App Setup

Our final recipe does some setup for our Rails application. Here's the code you'll need to add to a new file called `app.rb`:

``` ruby app.rb
# create www directory
directory "/var/www" do
  user node['user']['name']
  group node['group']
  mode 0755
end

# create shared directory structure for app
path = "/var/www/#{node['app']}/shared/config"
execute "mkdir -p #{path}" do
  user node['user']['name']
  group node['group']
  creates path
end

# create database.yml file
template "#{path}/database.yml" do
  source "database.yml.erb"
  mode 0640
  owner node['user']['name']
  group node['group']
end

# set unicorn config
template "/etc/init.d/unicorn_#{node['app']}" do
  source "unicorn.sh.erb"
  mode 0755
  owner node['user']['name']
  group node['group']
end

# add init script link
execute "update-rc.d unicorn_#{node['app']} defaults" do
  not_if "ls /etc/rc2.d | grep unicorn_#{node['app']}"
end
```

The only new resource here is [`directory`](http://docs.getchef.com/chef/resources.html#directory), which we use to create a new `/var/www` directory for our Rails app. One other new thing is the `creates` attribute inside the second `execute` resource, which is used to prevent the resource from creating the `/var/www/phindee/shared/config` directory if it already exists. If you're wondering why we're using `execute` and not `directory`, it's because it's pretty messy to create recursive directories using `directory`, and this just seems cleaner to me.

And finally, here are the two template files we're referencing inside the `template` resources above:

``` erb database.yml.erb
production:
  adapter: postgresql
  encoding: unicode
  database: <%= node['app'] %>
  pool: 5
  host: localhost
  username: <%= node['db']['user']['name'] %>
  password: <%= node['db']['user']['password'] %>
```
``` erb unicorn.sh.erb
#!/bin/sh

set -e
# Example init script, this can be used with nginx, too,
# since nginx and unicorn accept the same signals

# Feel free to change any of the following variables for your app:
TIMEOUT=${TIMEOUT-60}
APP_ROOT=/var/www/<%= node['app'] %>/current
PID=$APP_ROOT/tmp/pids/unicorn.pid
CMD="cd $APP_ROOT; ~/.rbenv/bin/rbenv exec bundle exec unicorn -D -c $APP_ROOT/config/unicorn.rb -E production"
AS_USER=<%= node['user']['name'] %>
set -u

OLD_PIN="$PID.oldbin"

sig () {
  test -s "$PID" && kill -$1 `cat $PID`
}

oldsig () {
  test -s $OLD_PIN && kill -$1 `cat $OLD_PIN`
}

run () {
  if [ "$(id -un)" = "$AS_USER" ]; then
    eval $1
  else
    su -c "$1" - $AS_USER
  fi
}

case "$1" in
start)
  sig 0 && echo >&2 "Already running" && exit 0
  run "$CMD"
  ;;
stop)
  sig QUIT && exit 0
  echo >&2 "Not running"
  ;;
force-stop)
  sig TERM && exit 0
  echo >&2 "Not running"
  ;;
restart|reload)
  sig HUP && echo reloaded OK && exit 0
  echo >&2 "Couldn't reload, starting '$CMD' instead"
  run "$CMD"
  ;;
upgrade)
  if sig USR2 && sleep 2 && sig 0 && oldsig QUIT
    then
    n=$TIMEOUT
    while test -s $OLD_PIN && test $n -ge 0
    do
      printf '.' && sleep 1 && n=$(( $n - 1 ))
    done
    echo

    if test $n -lt 0 && test -s $OLD_PIN
    then
      echo >&2 "$OLD_PIN still exists after $TIMEOUT seconds"
      exit 1
    fi
    exit 0
  fi
  echo >&2 "Couldn't upgrade, starting '$CMD' instead"
  run "$CMD"
  ;;
reopen-logs)
  sig USR1
  ;;
*)
  echo >&2 "Usage: $0 <start|stop|restart|upgrade|force-stop|reopen-logs>"
  exit 1
  ;;
esac
```

And with that, our recipes are complete! We're now ready to use them to provision our node, and that's exactly what we'll cover in [part 3]({{ root_url }}/blog/2014/08/13/provisioning-a-rails-server-using-chef-part-3-tying-it-all-together/).