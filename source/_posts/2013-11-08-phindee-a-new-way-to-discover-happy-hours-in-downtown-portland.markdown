---
layout: post
title: "Phindee: A New Way to Discover Happy Hours in Downtown Portland"
date: 2013-11-08 12:59
comments: true
categories: [Projects, Rails, phindee]
---

I love Portland. It’s a fun, quirky city that makes me feel right at home. And the longer I live here, the deeper my affection grows. There are many reasons why this is so, but one high on the list is the food scene. Now I haven’t lived in any other major city, so I can’t compare, but others who have tend to agree. <!-- more -->

I’m certainly satisfied.

# An Idea Is Born

Of course, eating out all the time can get a bit expensive, and being a college student, I’m definitely not swimming in cash. I usually eat out just for lunch because I hate bringing cold lunch, but even this can quickly add up. So in an effort to save money (and to learn Ruby on Rails), I built a happy hour web application a couple months ago called [phindee](http://phindee.com/). 

Being a web developer, I always enjoy learning about other people's stacks, so I'd like to return the favor and share how phindee works.

# A Look at the Wiring

When you visit phindee, you’re presented with a map of the current happy hours in downtown Portland, along with information like the happy hour type and time, as well as the name, phone number, website, and address of its location. And of course, it doesn’t matter what device you use to visit phindee because it’s based on a responsive design.

Behind the scenes, phindee sits on top of a [Linode](http://linode.com/) server powered by [Ubuntu](http://www.ubuntu.com/) and served by [Nginx](http://nginx.org/) and [Unicorn](http://unicorn.bogomips.org/). I originally had it setup with [Passenger](https://www.phusionpassenger.com/), but since I like to do multiple deploys a day, I got tired of Passenger restarts and site downtime. Unicorn solves this nicely. 

## Deployment

With regards to choosing Nginx, it was a matter of simplicity and speed. Phindee marked my first try at setting up a server from scratch, and from what I read online, Nginx was best suited for my situation. When it came to the actual setup, Ryan Bates’ [Railscasts episodes](http://railscasts.com/) helped me out tremendously, especially his episode about [VPS deployment](http://railscasts.com/episodes/335-deploying-to-a-vps).

Up to that point, my previously deployment experience consisted of firing up [FireFTP](http://fireftp.net/) and dragging and dropping the necessary files into the appropriate directories on my server. Funny, I know. As a result, it took me a couple of long nights to get everything working properly. Looking back, it was definitely worth it though.

## Storage

With regards to storage, I went with [SQLite](http://www.sqlite.org/) because it was already setup as the Rails default database. I know, kinda lame, but figuring out how to setup a more sophisticated database did not seem like a good use of time, especially since I already had my hands full with server setup. But now that I'm done, I do plan on migrating to a [PostgreSQL](http://www.postgresql.org/) and [Redis](http://redis.io/) backend in the near future.

## Mapping

The mapping functionality is provided by the excellent [MapBox JavaScript API](https://www.mapbox.com/mapbox.js/). I stumbled upon MapBox thanks to an A List Apart [article](http://alistapart.com/article/hack-your-maps) I had read. I originally planned on using Google Maps, but the level of customization MapBox allows is incredible and their documentation is outstanding. On top of that, I feel like Google already has enough money, so why not support an open source service built by a cool new company? More diversity can't hurt, right?

## Icons

The icons came from [The Noun Project](http://thenounproject.com/), an excellent collection of vector symbols. All the icons are free, but you are required to attribute the designer if you use them. If that’s not possible, you’re free to purchase a full license from the designer and use the icon without attribution; the fee is usually $1.99.

## Preprocessors
Finally, I rely on [SLIM](http://slim-lang.com/) to generate the HTML, [SASS](http://sass-lang.com/) to generate the CSS, and [CoffeeScript](http://coffeescript.org/) to generate the JavaScript. These pre-processors are easy to pick up, and they’ll save you more than a few keystrokes.

# The Power of the Web

The world population is now approaching 7.1 billion and [2.5 billion of those](http://data.worldbank.org/indicator/IT.NET.USER.P2) are able to access a web application I can build with nothing more than a laptop. I don’t know about you, but that’s mind boggling to me. There are few other professions that have the same reach with such a limited resource pool.

And beyond that, the internet is one of the few things still in existence that gives power and influence to anybody and everybody who has access to it. It transcends borders and gives people a voice. It’s a tremendous blessing that must never be taken away nor destroyed.

It’s an exciting time to be a web developer.