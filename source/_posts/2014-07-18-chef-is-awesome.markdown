---
layout: post
title: "chef is awesome"
date: 2014-07-18 15:06
comments: true
categories: 
description:
---

About a month ago, I was in the middle of upgrading the server running [Phindee] using the harmless (or so I thought) `apt-get upgrade`. All appeared to be going well until I visited the app in the browser. Staring back at me was the infamous "We're sorry, but something went wrong" page.

<!-- more -->

I hit the logs, and luckily, it turned out to be a minor problem that was fixable without too much downtime. Needless to say, I have not ran `apt-get upgrade` on my Phindee server since that day.

But what if I wasn't so lucky and the problem wasn't as easy to fix? What if my server was wrecked and I had to rebuild it from scratch? That would be a nightmare because I would need to provision the server manually&mdash;by hand! 

There had to a better solution.

Since my server was running on [DigitalOcean](http://digitalocean.com/), one possible solution was to take a snapshot of it in a fully-provisioned state and use that for future rebuilding. But this would tie me to DigitalOcean, which I love, but I still like having the freedom to switch providers freely if the need arises.

Another solution was to write a script that executed all the commands I ran to provision the server manually, and this would work, but I had also heard about a tool called [Chef](https://github.com/opscode/chef) that's specifically designed for these kinds of things, and I wanted to see if it was something I could use. After a bit of research, I decided to give it a try. Fast forward a couple weeks, and I'm now able to provision a server from scratch with a single command.

It's really cool and it'll make you feel like a badass.

# Why Chef?

Besides Chef, you could also use a tool called Puppet. There are some [good](https://www.quora.com/What-are-the-key-reasons-to-choose-Puppet-over-Chef-or-vice-versa)   [articles](http://devopsanywhere.blogspot.com/2011/10/puppet-vs-chef-fight.html)comparing the two, but the main reason why I went with Chef is because Puppet was designed with system administrators in mind, while Chef was designed with developers in mind, and as a developer, Chef is more natural for me to work with because it feels a lot like programming. Each tool has its strenghts and weaknesses though, and you should pick the one that best fits <em>your</em> needs.

But you might not even need Puppet or Chef at all. If you just need to provision a single server every now and then, a simple shell script will probably do. I decided to learn Chef because I'll be working with servers for the foreseeable future and being able to automate their provisioning will help me save a significant amount of time down the road.

One thing that a tool like Chef offers over shell scripts is idempotency. Idempotency is when you're able to run something over and over again safely. With Chef and Puppet, you're not only able to provision your server, but you can also rerun it to verify that your server is in the state you defined it to be and correct it if it's not. For example, if the initial server permissions or configuration settings change, you can easily bring them back to their original state by rerunning your recipe. You can't say the same thing about a shell script, unless you're extremely careful.

Puppet and Chef also allow you to easily access the data about your system, such as kernel name, version, and release, in a way that works across platforms. You can easily target specific servers or run against multiple servers, and your configuration files can be easily customized for particular users. But perhaps most importantly, your recipes will be far more readable than shell scripts, and that's almost worth it on its own.

# Chef Solo


