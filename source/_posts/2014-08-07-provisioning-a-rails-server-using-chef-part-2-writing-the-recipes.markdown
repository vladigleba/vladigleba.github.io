---
layout: post
title: "Provisioning a Rails Server Using Chef Part 2: Writing the Recipes"
date: 2014-08-07 19:33
comments: true
categories: [Server Provisioning, Phindee]
description:
---

In [part 1](), we learned about Chef Solo and used it to create a standard Chef directory structure, along with a standard cookbook directory structure. Now it's time to start writing the recipes that we will run to provision our Rails server and install Nginx, Node.js, PostgreSQL, rbenv, and Redis.

<!-- more -->

# Defining Default Values

Alright, the first thing we'll do is define some default values for our recipes. Go ahead and create a new file called `default.rb` inside the `/attributes` directory of the cookbook you created in part 1 and fill it with the following code:

``` ruby default.rb
default['app']               = 'phindee'

default['nodejs']['dir']     = '/usr/local'
default['nodejs']['version'] = '0.10.29'

default['ruby']['version']   = '2.1.2'
default['redis']['version']  = '2.8.13'
```

These are called attributes, and they're just variables that are later used in recipes. We're defining simple things here like the app name, the directory where Node.js will be installed, and the versions of the software we'll be installing. Storing such things in a single file makes it easy to modify them later on.

This file is great for storing attributes that will be shared with more than one server, but attributes that are server-specific, like ports, usernames, and passwords, will be stored in another JSON file outside your cookbook. If you followed part 1, your cookbook is stored in your app's `/config/chef/site-cookbooks` directory, but this JSON file will reside inside the `/config/chef/nodes` directory, and it'll be named after the IP address of the server you'll be provisioning (for example, `123.123.123.123.json`).

Go ahead and create the file now and add the following code into it (be sure to replace the attributes with your own):

``` json 123.123.123.123.json
{ 
  "group": "foobars",
  "port": 11111,
  
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

I'd like to point out that when creating new users, Chef doesn't use plain text passwords. Instead, it uses a [shadow hash](http://en.wikipedia.org/wiki/Passwd#Shadow_file) of the plain text password, so the `user.password` attribute must be a shadow hash. If you have the `openssl` command installed on your local computer, you can create a password shadow hash by running the following:

``` bash
openssl passwd -1 "theplaintextpassword"
```

This just uses the `passwd` command provided by `openssl` to create an MD5-based hash of the password (specified by the `-1` flag). You can then copy and paste the string that the command returns into the JSON file above. (I wasn't able to get shadow hash passwords working with PostgreSQL, which is why I'm just using the plain text password there, but feel free to leave a comment if you know how to make it work.)

One last thing I want to mention is that if you have the same attribute defined in both `default.rb` and the JSON file, the latter will always override the former.

# Writing Recipes

Now that the attributes are defined, we're ready to start writing the recipes themselves. These recipes do the exact same server setup as the one covered in the ["Deploying Rails Apps" series](), so I won't be explaining the whys behind the things I do here since that's already covered in the series itself. If you've never provisioned a server from scratch before, it's best to read that series first before continuing.

## The First One

Our first recipe will install various packages and set the correct time zone. Create a new file called `default.rb` inside the `/recipes` directory of your cookbook and add the following code into it:

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

Chef uses a domain-specific language (DSL) for writing recipes, and the code above is what it looks like. A recipe is made up of resources, and a resource is simply an abstraction of some shell code you would run to provision your server. Chef provides most of the resources you will need, but you can also write your own.

In the file above, we're using three resources: [`execute`](http://docs.getchef.com/chef/resources.html#execute), [`package`](http://docs.getchef.com/chef/resources.html#package), and [`bash`](http://docs.getchef.com/chef/resources.html#bash). The `execute` resource executes a command, the `package` resource manages packages, and the `bash` resource executes scripts using the Bash interpreter. So in the code above, we're first using `execute` to run `apt-get update` to fetch the latest updates for the packages on our server (known as a node in Chef terminology). Next, we use `package` to install the various packages our node will need, and finally, we use `bash` to execute two lines of code that will set the correct time zone (be sure to modify the `echo` command so it sets your own time zone).

Each resource has various attributes that you can optionally specify inside a `do...end` block. For example, with the `bash` resource, we're using the `code` attribute to specify the code that will run to set the timezone (see the [documentation](http://docs.getchef.com/chef/resources.html#bash) to learn about the other attributes it supports). This is similar to the `execute` resource, which also runs commands, but `execute` is used to run a single command, while `bash`'s `code` attribute is used to run more than one.

We could've specified attributes for the `execute` and `package` resources as well, but there is no need in this case. For example, this

``` ruby
execute "update packages" do
  command "apt-get update"
end
```

is equivalent to `execute "apt-get update"`. The only difference between the two is the longer version gives the resource block a name&mdash;"update packages" in this case, but it could've been anything&mdash;while the shorter version just specifies the command to execute. When the `command` attribute is missing, the name is the command that is executed, and that's why the shorter version works just as well.

One last interesting thing about the `bash` resource is the `not_if` line. This is called a [guard attribute](http://docs.getchef.com/chef/resources.html#guards), and it can be applied to any resource, not just `bash`. It's used to prevent a resource from running if certain conditions are met. In this case, I'm specifying a command that will output the current date and search for either the word "PDT" (Pacific Daylight Time) or "PST" (Pacific Standard Time) to see if the correct time zone is set (be sure to modify this for your own time zone). The guard will be applied and the resource won't run if the command returns `0`, which is the case with `grep` when it finds a match.

## Working with Users

This next recipe will create a new user and group. Add a new file called `users.rb` to the directory containing the previous recipe and fill it with the following:

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

Next, we use the [`user` resource](http://docs.getchef.com/chef/resources.html#user) to create a new user whose name is also defined in the JSON file. But now it gets interesting because there is a handful of additional attributes we're using:

- `gid` assigns this user to the group we created right before
- `home` specifies the location of the user's home directory
- `password` accepts a shadow hash of the users password
- `shell` specifies the login shell that the user will log in with (user won't have login access without this attribute)
- `supports` sets `manage_home` to `true` to tell Chef to create the home directory when the user is created

The last block of code adds a line to the `sudoers` file that gives the group `sudo` privileges, but it does this only if the line isn't already there.

# Restricting SSH Access

Next thing we'll do is restrict SSH access to the server. Add the following code into a new file called `ssh.rb`:

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

Chef has a [`service` resource](http://docs.getchef.com/chef/resources.html#service) designed for managing services like SSH. We tell it to manage SSH by specifying "ssh" as the resource name, and since we don't have a `service_name` attribute listed, Chef automatically assumes that the resource name is also the name of the service we want to manage (see the [documentation](http://docs.getchef.com/chef/resources.html#service)).

We then use the `provider` attribute to tell Chef to use [upstart](https://en.wikipedia.org/wiki/Upstart) to manage the service. This is necessary whenever there are two or more services available for managing a resource, which is the case with SSH on the node I'm running. My node has an upstart job (located in `/etc/init`) and a traditional init script (located in `/etc/init.d`) for managing SSH, and I decided to go with upstart since it's superior, but either will work for our purposes. If there is only one service provider available, Chef will pick it automatically, and there is no need for the `provider` attribute.

By default, Chef inspects the process table to see if a service is running, but it's also possible to use the `service ssh status` command (which is more reliable) to do the same thing. That's why we use the `supports` attribute to tell Chef to use the `status` command instead. And while we're at it, we also give Chef permission to use the `restart` command to restart SSH.

Once the service is defined, we use the `bash` resource to modify the SSH port, disable `root` login, restrict login access just to our created user, and disable DNS lookup. Each `bash` block also uses the [`notifies` attribute](http://docs.getchef.com/chef/resources.html#notifications) to tell the SSH `service` resource we just defined to restart itself <em>if</em> the code inside the `code` attribute actually runs. But we use the `delayed` timer to tell Chef to queue up the notification and run in at the very end. The other option is to use the `immediate` timer to do the restart immediately, but we don't want to restart the service four separate times when we can just wait till the end and do it just once.

And just like in the two previous recipes, we use the `not_if` guard to make  sure the `bash` resources don't run if the necessary changes are already made.

## Installing Node.js

Next order of business is installing Node.js. Create a `nodejs.rb` file with the following contents:

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