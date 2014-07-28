---
layout: post
title: "Provisioning a Rails Server Using Chef, Part 1: Introducing Chef Solo"
date: 2014-07-18 15:06
comments: true
categories: 
description:
---

About a month ago, I was in the middle of upgrading the server running [Phindee](http://phindee.com/) using the harmless (or so I thought) `apt-get upgrade`. All appeared to be going well until I visited the app in the browser. Staring back at me was the infamous "We're sorry, but something went wrong" page.

<!-- more -->

I hit the logs, and luckily, it turned out to be a minor problem that was fixable without too much downtime. Needless to say, I have not ran `apt-get upgrade` on my Phindee server since that day.

But what if I wasn't so lucky and the problem wasn't as easy to fix? What if my server was wrecked and I had to rebuild it from scratch? That would be a nightmare because I would need to provision everything manually&mdash;by hand! 

There had to a better way of doing this.

Since my server was running on [DigitalOcean](http://digitalocean.com/), one possible solution was to take a snapshot of it in a fully-provisioned state and use that for future rebuilding. But this would tie me to DigitalOcean, which I love, but I still like having the freedom to switch providers freely if the need arises.

Another solution was to write a script that executed all the commands I ran to provision the server manually, and this would work, but I had also heard about a tool called [Chef](https://github.com/opscode/chef) that's specifically designed for these kinds of things, and I wanted to see if it was something I could use. After a bit of research, I decided to give it a try. Fast forward a couple weeks, and I'm now able to provision a server from scratch with a single command.

It's really cool and it'll make you feel like a badass.

# Why Chef?

Besides Chef, you could also use a tool called Puppet. There are some [good](https://www.quora.com/What-are-the-key-reasons-to-choose-Puppet-over-Chef-or-vice-versa) [articles](http://devopsanywhere.blogspot.com/2011/10/puppet-vs-chef-fight.html)comparing the two, but the main reason why I went with Chef is because Puppet was designed with system administrators in mind, while Chef was designed with developers in mind, and as a developer, Chef is more natural for me to work with because it feels a lot like programming. Each tool has its strengths and weaknesses though, and you should pick the one that best fits <em>your</em> needs.

But you might not even need Puppet or Chef at all. If you just need to provision a single server every now and then, a simple shell script will probably do. I decided to learn Chef because I'll be working with servers for the foreseeable future and being able to automate their provisioning will help me save a significant amount of time down the road.

One thing that a tool like Chef offers over shell scripts is idempotence. Idempotence is when you're able to run something over and over again safely. With a tool like Puppet or Chef, you're not only able to provision your server, but you can also use it to verify that your server is in the state you defined it to be in and correct it if it's not. So if the initial server permissions or configuration settings change, you can easily bring them back to their original state by rerunning your recipe. You can't really say the same thing about a shell script (unless you're extremely careful).

Puppet and Chef also allow you to easily access the data about your system, such as kernel name, version, and release, in a way that works across platforms. You can easily target specific servers or run against multiple servers, and your configuration files can be easily customized for particular users. But perhaps most importantly, your recipes will be far more readable than shell scripts, and that's almost worth it on its own.

# Chef Solo vs. Chef Server

Chef comes in two flavors: Chef Solo and Chef Server. Chef Solo is a basically a simpler version of Chef Server, and it's designed to be used with a small number of servers. This fits my needs my perfectly because I'm currently running Phindee on a single server. With Chef Solo, you write your recipes on your local computer, upload them to your server, and Chef Solo runs them on the server. (A recipe is a file containing the commands that will run to provision your server.)

With Chef Server, you still write your recipes on your local computer, but instead of uploading them to the server you want provisioned, you upload them to a server that's specifically dedicated to Chef. This server acts as the main repository of all your recipes and other Chef configuration. The servers you want provisioned will then have a program running on them (referred to as a Chef client) that is in constant communication with your Chef server, and whenever you upload your recipes to Chef server, Chef client will notice this and run them automatically. Chef Solo is also Chef client; it just doesn't need a Chef server to do its job.

Since Phindee is running on a single server, I currently have no need for Chef Server, but if Phindee grows to multiple servers, I'll definitely consider it.

# Working with Chef Solo

One nice thing about Chef Server is you get to use a command-line tool called Knife that allows you to easily communicate with Chef Server right from your local computer. It gives you commands to easily upload your recipes, for example, among many other things. Unfortunately, it doesn't offer similar commands for Chef Solo, but there is a Knife plugin called [knife-solo](https://github.com/matschaffer/knife-solo) that does just this. Since it's packaged as a gem, all we need to do is add the following lines to our app's Gemfile:

``` ruby Gemfile
group :development do
  gem 'knife-solo', '~> 0.4.2'
end
```

and then run `bundle` to install it. This will install the Chef gem as well.

If you now `cd` into your app's root directory and run `knife`, you'll see a list of all the commands available to you through Knife, including those provided by knife-solo, which start with `knife solo ...`.

## Diving In

With that out of the way, we're ready to start working with Chef Solo. The first thing we'll do is create a configuration file for Knife:

``` bash
knife configure -r . --defaults
```

This will create a new `~/.chef` directory with a file called `knife.rb` containing some default configurations. This file is used by Chef Server, so we actually won't need it, but Knife will keep complaining if we don't create it.

Next, `cd` into your app's `/config` directory and run the following:

``` bash
knife solo init chef
cd chef
```

This will create a new directory called `/chef` inside your app's `/config` directory. It will contain a standard Chef directory structure, also known as a "kitchen," that looks like this:

    chef/
    ├── cookbooks
    ├── data_bags
    ├── environments
    ├── nodes
    ├── roles
    └── site-cookbooks

Below is a brief explanation of each directory:

- `cookbooks`: holds recipes written by the community
- `data_bags`: stores sensitive configuration for your infrastructure
- `environments`: contains the environments you've defined for Chef Server
- `nodes`: stores server-specific information
- `roles`: contains the roles you've defined for Chef Server
- `site-cookbooks`: holds recipes written by you

Although it's not part of a standard Chef directory structure, Chef Solo will also create a hidden `/.chef` directory containing a `knife.rb` file. This file is exclusively for Chef Solo, while the one we created earlier is for Chef Server.

## Explanation of Chef Terms

I introduced some new terms while explaining the directory structure above, so lets briefly go over them.

A cookbook is a collection of one or more recipes that will be run to set up and configure your servers. These servers are known as "nodes" and each node belongs to an environment. An environment is the stage that a node is in. For example, you can define a "testing" and a "production" environment to differentiate between node in the testing stage and those in production. We won't need this functionality, and it's actually only available in Chef Server.

A node can also have a role assigned to it that describes what the node does. For example, you can assign nodes running your databases to the database role, while nodes running the actual Rails application are assigned to the application role. This would make sense in a production environment, but in testing, you might have a node running both the database and the application, so you would assign it to both roles.

Data bags are subdirectories containing JSON files that store sensitive configuration for your infrastructure. Because they're used to store confidential information, they can be encrypted. They cannot, however, be assigned to a Chef environment, and should therefore be used to only store truly global configuration details.

We won't be using data bags, environments, or roles with Chef Solo, so these directories will remain empty. Our `/cookbooks` directory will also remain empty because I won't be using any community-provided cookbooks. They tend to be complex and bloated with code because they offer different ways of installing packages and they try to cover as many operating systems as possible. I think they're a great way to learn Chef, but when it's time to write a recipe, I prefer to write my own because I want them to be readable, simple, and small.

## Creating Our Own Cookbook

Alright, with the terms clarified, we're now ready to create our own cookbook. Make sure you're in the `/chef` directory we created above, and then run the following command (replace "phindee" with the name of your own app):

``` bash
knife cookbook create phindee -o site-cookbooks
```

This creates a cookbook called "phindee" and uses the `-o` option to tell Knife to store it in the `/site-cookbooks` directory. Remember, this is the directory for storing our own cookbooks, while the `/cookbooks` directory is for those written by the community. (In fact, anything stored in `/cookbooks` won't even be version controlled.)

If you then do an `ls` inside the cookbook we just created, you'll find the following directory structure:

    phindee/
    ├── attributes
    ├── definitions
    ├── files
    ├── libraries
    ├── metadata.rb
    ├── providers
    ├── recipes
    ├── resources
    └── templates

Here's a brief description of the files and directories you should know about:

- `attributes`: folder for defining default values for recipes
- `files`: contains files that are copied and placed on the server
- `metadata.rb`: stores metadata about your cookbook, like name, version, dependencies, etc.
- `recipes`: stores the recipes that are part of the cookbook
- `templates`: stores ERB (Embedded Ruby) files that are later converted to configuration files

The rest of the directories are for advanced users, and I won't be explaining them here.

And with that, we reached the end of part 1. Now that the groundwork is done, we're ready to start writing the recipe that will provision our Rails server, which we'll do in part 2.