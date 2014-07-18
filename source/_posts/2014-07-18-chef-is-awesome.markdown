---
layout: post
title: "chef is awesome"
date: 2014-07-18 15:06
comments: true
categories: 
description:
---

A month or so ago, I was in the middle of upgrading the server running my [Phindee] app using the harmless (or so I thought) `apt-get upgrade` command. All appeared to be going well until I visited the app in my browser. Staring back at me was the infamous "We're sorry, but something went wrong" page. My blood pressure spiked instantly.

Luckily, after hitting the logs, I discovered it was a minor problem that I was quickly able to figure out (thanks in part to Google). I have not ran `apt-get upgrade` on my Phindee server since that day.

<!-- more -->

Imagine what would've happened if the problem was bigger and hairier and took hours to figure out. What if my server was toast and I had to rebuild it. From scratch. By hand.

Wouldn't it be wonderful if you could rebuild your server from scratch by running just a single command? It's actually possible, and what makes it so is a something called Chef.
