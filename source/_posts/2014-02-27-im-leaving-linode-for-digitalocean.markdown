---
layout: post
title: "I'm Leaving Linode for DigitalOcean"
date: 2014-02-27 08:16
comments: true
categories: [Deployment]
---

A few weeks ago, I ran into a [blog post](http://blog.schneidmaster.com/digital-ocean-vs-linode/) (and the resulting [Hacker News discussion](https://news.ycombinator.com/item?id=7021664)) comparing two popular VPS providers: [Linode](https://www.linode.com/) and [DigitalOcean](https://www.digitalocean.com/). Up until that point, I was a happy Linode customer for over two years. I had heard about DigitalOcean previously, but never considered trying it since I was happy with Linode. This post, however, intrigued me enough to try DigitalOcean out.

<!-- more -->

Fast forward to today and [Phindee](http://www.phindee.com/) is now running on DigitalOcean servers!

# What’s so Cool about DigitalOcean?

I was drawn to DigitalOcean due to one killer feature, and I would've moved because of this one feature alone: their billing policy. Let me explain.

## Flexible Billing

When you create a new instance with Linode, you’re immediately charged for the entire month; if you then decide to destroy that instance a few days later, Linode will return a large portion of that month’s payment as Linode credit. With DigitalOcean, however, you’re only charged for what you use&mdash;no more, no less&mdash;so if you spin up an instance and decide to delete it the next day, you’ll be charged only for those few hours you used up.

I’ve lost track of the number of instances I’ve temporarily spun up since switching over to DigitalOcean three weeks ago, but I can count the number of times I did this with Linode on one of my two hands. The benefits of this flexibility are obvious: higher incentive to experiment with new technologies, test prototypes, and tinker with new ideas. 

But that’s not all.

## Lower Starter Plan

Besides flexible billing, I also like DigitalOcean’s plans, which I find to be perfect for apps with small amounts of traffic. Linode’s plans start at $20 a month and paying that much to host apps that receive less than 500 visits a month seemed a little ridiculous to me. 

DigitalOcean’s plans start at $5 a month, which gives you 512MB of memory, a 20GB SSD disk, and 1TB of transfer. Linode’s basic $20 a month plan gives you 1024MB of RAM, a 48GB disk, and 2TB of transfer, which is similar to DigitalOcean’s $10 plan. In effect, DigitalOcean offers the same thing at half the price, and this carries over to the more expensive plans as well.

In effect, Linode’s starter plan seemed a bit overkill for my low traffic apps, while DigitalOcean suited them perfectly, so my choice was easy.

# Credit Where It's Due

This post, however, would not be complete if I didn’t give credit where it’s due. 

During my two years with Linode, I experienced absolutely no down-time; I think this speaks volumes to the quality of their products. I also want to mention their excellent [library of guides](https://library.linode.com/), which I found to be an invaluable resource whenever I needed help configuring my server.

But perhaps the thing their known for the most is their excellent customer service. Although I never had a need to contact support, I’ve only heard good things from other people, and some developers choose Linode solely due to their outstanding customer service. 

Now in the interests of fairness, I should mention that Linode’s security record [is not spotless](https://blog.linode.com/2013/04/16/security-incident-update/), and they have been criticized for the way they handled some of their breaches, but I find this to be the exception rather than the norm. As long as this is a rare occurrence, Linode’s other pros outweigh this con.

Make no mistake, I’m leaving as a happy customer who was merely tempted and eventually won over by DigitalOcean’s flexible billing and a lower starter plan. I will have no hesitation coming back if the need arises.

# A Word About Future Posts

Now that I’ve successfully moved Phindee over to DigitalOcean, I will use the next six posts to show you how I went about deploying Phindee from scratch. This is how I'll break it down:

- [Deploying Rails Apps, Part 1: Securing the Server]({{ root_url }}/blog/2014/03/05/deploying-rails-apps-part-1-securing-the-server/)
- [Deploying Rails Apps, Part 2: Setting up the Server]({{ root_url }}/blog/2014/03/14/deploying-rails-apps-part-2-setting-up-the-server/)
- [Deploying Rails Apps, Part 3: Configuring Unicorn]({{ root_url }}/blog/2014/03/21/deploying-rails-apps-part-3-configuring-unicorn/)
- [Deploying Rails Apps, Part 4: Configuring Nginx]({{ root_url }}/blog/2014/03/27/deploying-rails-apps-part-4-configuring-nginx/)
- [Deploying Rails Apps, Part 5: Configuring Capistrano]({{ root_url }}/blog/2014/04/04/deploying-rails-apps-part-5-configuring-capistrano/)
- Deploying Rails Apps, Part 6: Writing Capistrano Tasks

If you'd like to be notified when these posts are out, feel free to [subscribe](http://www.feedblitz.com/f/?sub=927939), and you'll get the complete post delivered right to your inbox as soon as it's released.
