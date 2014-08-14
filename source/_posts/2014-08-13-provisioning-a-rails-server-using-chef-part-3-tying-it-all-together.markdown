---
layout: post
title: "Provisioning a Rails Server Using Chef, Part 3: Tying It All Together"
date: 2014-08-13 15:02
comments: true
categories: [Server Provisioning, Phindee]
description: 
---

We installed Chef Solo in [part 1]({{ root_url }}/blog/2014/07/28/provisioning-a-rails-server-using-chef-part-1-introduction-to-chef-solo/), we wrote some recipes in [part 2]({{ root_url }}/blog/2014/08/12/provisioning-a-rails-server-using-chef-part-2-writing-the-recipes/), and now we'll be tying everything together in part 3. When we're done, we'll not only have a fully provisioned server running your Rails app, but we'll also have an automated way of repeating this process whenever such a need arises in the future. It'll be glorious.

## Some Groundwork

