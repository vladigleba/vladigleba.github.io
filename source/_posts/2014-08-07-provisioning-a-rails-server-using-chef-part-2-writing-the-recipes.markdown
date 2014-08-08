---
layout: post
title: "Provisioning a Rails Server Using Chef Part 2: Writing the Recipes"
date: 2014-08-07 19:33
comments: true
categories: [Server Provisioning, Phindee]
description:
---

In [part 1](), we learned about Chef Solo and used it to create a standard Chef directory structure, along with a standard cookbook directory structure. Now it's time to start writing the recipes that we will run to provision our Rails server and install Nginx, Node.js, PostgreSQL, rbenv, and Redis.

Alright, the first thing we'll do is define some default values for our recipes. Go ahead and create a new file called `default.rb` inside the `/attributes` directory of the cookbook you created in part 1 and fill it with the following code:

``` ruby default.rb
default['nodejs']['dir']     = '/usr/local'
default['nodejs']['version'] = '0.10.29'

default['ruby']['version']   = '2.1.2'
default['redis']['version']  = '2.8.13'
```

Here we're just specifying simple things like the directory where Node.js will be installed, along with the Node.js, Ruby, and Redis versions we'll be installing. Storing such things in a single file makes it easy to modify them later on.

I like to use this file for values that will be shared with more than one server, but values that are server-specific, like ports, usernames, and passwords, will be stored in a JSON file outside your cookbook. If you followed part 1, your cookbook is stored in your app's `/config/chef/site-cookbooks` directory, but this JSON file will reside inside the `/config/chef/nodes` directory, and it'll be named after the IP address of the server you will be provisioning (for example, `111.111.111.111.json`). Here are the values that need to be defined:

``` json 111.111.111.111.json
{ 
  "root_password": "password-shadow-hash",
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




