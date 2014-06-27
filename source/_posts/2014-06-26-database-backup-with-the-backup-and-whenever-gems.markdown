---
layout: post
title: "Backup Your Rails Database with the Backup and Whenever Gems"
date: 2014-06-26 16:22
comments: true
categories: [Rails, Storage, Phindee]
description: Learn how to backup your Rails database with the Backup and Whenever gems.
---

I recently gave [Phindee]() users the ability to "like" happy hours. Up until that point, all my happy hour data was safely tucked away in a version-controlled `seed.rb` file, but now I was dealing with data that was dynamically generated and not being backed up anywhere. And that is not a good thing.

<!-- mroe -->

So I went over to the [ruby-toolbox.com](https://www.ruby-toolbox.com/categories/backups) "Backups" page to familiarize myself with the various backup tools available for Ruby projects. The [Backup gem](https://github.com/meskyanichi/backup) was (and is) the most popular one by far, and after doing a bit of reading about it, I was impressed by its ease of use (not to mention all the [features it supports](http://meskyanichi.github.io/backup/v4/)). I knew I had to try it out.

Having now used it for a few weeks, I'd like to explain how I set it up so you can take advantage of it as well.

# Setting It Up

To install Backup, log in to your VPS containing the data you'd like to backup and run the following:

``` bash
gem install backup
```

You can then run `backup` to familiarize yourself with all the commands it provides. We'll configure it by running:

``` bash
backup help generate:model
```

A model is 