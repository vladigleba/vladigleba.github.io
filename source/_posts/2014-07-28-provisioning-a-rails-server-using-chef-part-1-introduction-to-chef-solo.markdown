---
layout: post
title: "Provisioning a Rails Server Using Chef, Part 1: Introduction to Chef Solo"
date: 2014-07-28 14:31
comments: true
categories: [Server Provisioning, Phindee, Chef Series]
description: Find out why you should use Chef, learn about the differences between Chef Solo and Chef Server, and create your first cookbook.
---

About a month ago, I was in the middle of upgrading the server running [Phindee](http://phindee.com/) using the harmless (or so I thought) `apt-get upgrade`. All appeared to be going well. But when I visited the app in the browser, staring back at me was the infamous "We're sorry, but something went wrong" page. I hit the logs, and luckily, it turned out to be a minor problem that was fixable without too much downtime.

<!-- more -->

But what if I wasn't so lucky and the problem wasn't as easy to fix? What if my server was wrecked and I had to rebuild it from scratch? That would be a nightmare because I would need to provision everything manually&mdash;by hand!  There had to be a better way of doing this.

Since my server was running on [DigitalOcean](http://digitalocean.com/), one possible solution was to take a snapshot of it in a fully-provisioned state and use that for future rebuilding. But this would tie me to DigitalOcean, which I love, but I still like having the freedom to switch providers freely if the need arises.

Another solution was to write a script that executed all the commands I ran to provision the server manually, and this would work, but I had also heard about a tool called [Chef](https://github.com/opscode/chef) that's specifically designed for these kinds of things, and I wanted to see if it was something I could use. After a bit of research, I decided to give it a try. Fast forward a couple weeks, and I'm now able to provision a Rails server from scratch with a single command. It's really cool, and it makes me feel like a badass.

# Why Chef?

Besides Chef, there is another popular tool you could use to provision your server called [Puppet](https://github.com/puppetlabs/puppet). There are some [good](https://www.quora.com/What-are-the-key-reasons-to-choose-Puppet-over-Chef-or-vice-versa) [articles](http://devopsanywhere.blogspot.com/2011/10/puppet-vs-chef-fight.html) comparing the two, but the main reason why I went with Chef is because Puppet was designed with system administrators in mind, while Chef was designed with developers in mind, and as a developer, Chef is more natural for me to work with because it feels a lot like programming. Each tool has its strengths and weaknesses though, and you should pick the one that best fits <em>your</em> needs.

You might not even need Puppet or Chef at all. If you just need to provision a single server every now and then, a simple shell script will probably do. I decided to learn Chef because I do server provisioning pretty often, so it'll save me a significant amount of time down the road.

One thing that a tool like Chef offers is idempotence, which means you're able to run something over and over again safely. With Chef (and Puppet), you're not only able to provision your server, but you can also use it to verify that your server is in the state it's supposed to be in and correct it if it's not. So if the initial server permissions or configuration settings change, you can easily bring them back to their original state by rerunning your recipe. You can't really say the same thing about a shell script (unless you do a significant amount of extra work).

Puppet and Chef also allow you to easily access information about your system, such as kernel name, version, and release, in a way that works across platforms. They make it easy to run your recipes against multiple servers too. But perhaps most importantly, they make your recipes readable, and that's almost worth it on its own.

# Chef Solo or Chef Server?

Chef comes in two flavors: Chef Solo and Chef Server. Chef Solo is a basically a simpler version of Chef Server because it's designed to be used with a small number of servers. With Chef Solo, you write your recipes on your local computer, upload them to your server(s), and Chef Solo is then called to run them. (A recipe, by the way, is a file containing the commands that will run to provision your server.)

With Chef Server, you still write your recipes on your local computer, but instead of uploading them to the server you want provisioned, you upload them to a server that's specifically dedicated to Chef. This server acts as the main repository of <em>all</em> your recipes. The servers you want provisioned will then have a program running on them (referred to as a Chef client) that is in constant communication with your Chef server, and whenever you upload your recipes to Chef server, Chef client will notice this and run them automatically. (Chef Solo is also Chef client; it just doesn't need a Chef server to do its job.)

Since Phindee is running on a single server, I currently have no need for Chef Server; Chef Solo does everything I need it to. Chef is a complex tool, and I found that there is enough new things to learn without the added complexity of Chef Server. If you're new to Chef, this is the route I recommend, even if you intend on using Chef Server, because the learning curve will be much more manageable.

# Working with Chef Solo

One nice thing about Chef Server is you get to use a command-line tool called Knife that allows you to easily communicate with Chef Server right from your local computer. It gives you commands to easily upload your recipes, for example, among many other things. Unfortunately, it doesn't offer similar commands for Chef Solo, but there is a Knife plugin called [knife-solo](https://github.com/matschaffer/knife-solo) that does just this. Since it's a packaged gem, all we need to do is add it to our app's Gemfile on our local computer, and the commands we need will be available automatically:

``` ruby Gemfile
group :development do
  gem 'knife-solo', '~> 0.4.2'
end
```

When you run `bundle` to install it, the Chef gem will be installed as well. If you then go into your app's root directory and run `knife`, you'll see a list of the commands available to you through Knife, including those provided by knife-solo, which will start with `knife solo ...`.

## Diving In

Having that installed, we're now ready to start working with Chef Solo. The first thing we'll do is create a configuration file for Knife on our local computer:

``` bash
knife configure -r . --defaults
```

This will create a new `~/.chef` directory with a file called `knife.rb` containing some default configurations. This file is used by Chef Server, so we actually won't need it, but Knife will keep complaining if we don't create it.

Next, go into your app's `/config` directory and run the following:

``` bash
knife solo init chef
cd chef
```

This will create a standard Chef directory structure (referred to as a "kitchen") inside a directory called `/chef`. It'll look like this:

    chef/
    ├── cookbooks
    ├── data_bags
    ├── environments
    ├── nodes
    ├── roles
    └── site-cookbooks

Here is a brief description of each one:

- `/cookbooks`: holds recipes written by the community
- `/data_bags`: stores sensitive configuration for your infrastructure
- `/environments`: contains the environments defined for Chef Server
- `/nodes`: stores server-specific information
- `/roles`: contains the roles defined for Chef Server
- `/site-cookbooks`: holds recipes written by you

Note that some of these directories are only for Chef Server, but they're created anyway because they're part of the standard Chef directory structure.

## New Chef Terms

There are some new terms above that I haven't explained yet, so lets briefly go over them.

A cookbook is a collection of one or more recipes that will be run to set up and configure your servers. These servers are known as "nodes" and each node belongs to an environment. An environment is the stage that a node is in. For example, you can define a "testing" and a "production" environment to differentiate between nodes in the testing stage and those in production. We won't need this functionality, and it's actually only available in Chef Server.

A node can also have a role assigned to it that describes what the node does. For example, you can assign nodes running your databases to the database role, while nodes running the actual Rails application are assigned to the application role. This would make sense in a production environment, but in testing, you might have a node running both the database and the application, so you would assign it to both roles.

Data bags are subdirectories containing JSON files that store sensitive configuration for your infrastructure. Because they're used to store confidential information, they can be encrypted. They cannot, however, be assigned to a Chef environment, and should therefore be used to only store truly global configuration details.

We won't be using data bags, environments, or roles with Chef Solo, so these directories will remain empty. Our `/cookbooks` directory will also remain empty because I won't be using any community-provided cookbooks. They tend to be complex and bloated with code because they support different installation options and they try to cover as many operating systems as possible. I think they're a great way to learn Chef, but when it's time to write a recipe, I prefer to write my own.

## Creating Our Own Cookbook

Alright, with the terms clarified, we're now ready to create our own cookbook. Go ahead and run the following inside the `/chef` directory we created above (replace "phindee" with the name of your app):

``` bash
knife cookbook create phindee -o site-cookbooks
```

This creates a cookbook called "phindee" and uses the `-o` option to tell Knife to store it in the `/site-cookbooks` directory. (Remember, this is the directory for storing our own cookbooks, while the `/cookbooks` directory is for those written by the community. In fact, anything stored in `/cookbooks` won't actually be version controlled.)

If you then do an `ls` inside the cookbook you just created, you'll see what a standard cookbook directory structure looks like. There will be a number of directories listed, but here are the ones you should know about: 

- `/attributes`: stores files that define default values for recipes
- `/files`: contains files that are copied and placed on the server
- `metadata.rb`: stores metadata about your cookbook, like name, version, dependencies, etc.
- `/recipes`: stores the recipes that are part of the cookbook
- `/templates`: stores ERB (Embedded Ruby) files that are later converted to configuration files

The rest of the directories are for advanced Chef setups, and I won't be explaining them here.

With our cookbook created, we're now ready to start writing the recipes that will provision our Rails server, which I'll cover in [part 2]({{ root_url }}/blog/2014/08/12/provisioning-a-rails-server-using-chef-part-2-writing-the-recipes/).