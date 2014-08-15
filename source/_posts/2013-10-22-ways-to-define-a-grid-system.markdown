---
layout: post
title: "Ways to Define a Grid System"
date: 2013-10-22 17:32
comments: true
categories: Design
description: Learn how to design grids based on the Fibonacci sequence, the canvas, or the content.
---

I [started blogging]({{ root_url }}/blog/2013/10/15/im-diving-in/) last week. And ever since publishing that first post, I've been trying to find a suitable design for my blog. I looked at many different blog designs for inspiration, and one of my favorites was Whitney Hess' <cite>[Pleasure and Pain](http://whitneyhess.com/blog/)</cite> blog. I don't know why, but the design just resonates with me. It feels right. 

<!-- more --> 

My knowledge of grid systems is limited, but I figured the design was probably based on a grid. So I decided to spend the past couple of days learning about grid systems. And because I strongly believe the best way to learn is to teach someone else, I would like to summarize what I learned.

Disclosure: I don't have a background in design, but I'm always eager to learn more, so if you're a designer, please feel free to contribute!

All right, on to grids.

> Spacing and the use of space is what holds a design together. Precise and effective space management can make the difference between an average design and an amazing one. ... How big is the header compared to the navigation bar?  How wide is the photo compared to the sidebar? These ratios are what make or break the balance, emphasis and flow of a design. Additionally . . . we constantly are looking for order and understanding of the world around us. ... Our mind is constantly seeking some reason, pattern or rational for what we are seeing. This is especially true of spacing, sizing and proportions. ... If that unity doesn’t exist it will always feel unpolished. <footer>&mdash;[Ross Johnson](http://3.7designs.co/blog/2010/10/how-to-design-using-the-fibonacci-sequence/)</footer>

I've learned about many different ways of defining grids that achieve this unity, but for reasons of brevity, I will talk about just three. 

# Grids Based on the Fibonacci Sequence

The Fibonacci Sequence looks like this:

    0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, ...

The first two numbers 0 and 1 are always given, and each number after that is the sum of the previous two. Now if you divide 144 by 89, you get 1.617, which is very close to the Golden Ratio (1:1.618). In fact, the higher the numbers in the sequence get, the closer they approach the [Golden Ratio](http://en.wikipedia.org/wiki/Golden_ratio), which is historically known to be aesthetically pleasing and is widely used in all kinds of domains.

Grids based on the Fibonacci sequence use its numbers to define virtually everything from font size and line-height to margins and column widths. The numbers can also be added, subtracted, multiplied, or divided together to offer more choices. I recommend reading Smashing Magazine's <cite>[Applying Mathematics to Web Design](http://www.smashingmagazine.com/2010/02/09/applying-mathematics-to-web-design/)</cite> article to see how the sequence is used to build an actual layout.

# Grids Based on the Canvas

These grids are built with ratios derived from the available canvas. For example, if your canvas is an A4-sized piece of paper, the ratio would equal the paper's length to width ratio. The canvas is then repeatedly divided according to the ratio and a grid is slowly built up. This creates a sense of connectedness and unity between your layout and the surrounding canvas. I won't go into any more detail, but you can read Mark Boulton's <cite>[Five Simple Steps](http://markboulton.co.uk/journal/five-simple-steps-to-designing-grid-systems-part-1)</cite> series for an illustrative example of this technique.

# Grids Based on the Content

> Content precedes design. Design in the absence of content is not design, it's decoration. <footer>&mdash;[Jeffrey Zeldman](https://twitter.com/zeldman/statuses/804159148)</footer>

I never really understood the reasoning behind this quote until I read A List Apart's <cite>[More Meaningful Typography](http://alistapart.com/article/more-meaningful-typography)</cite> article. The article describes how to achieve visual harmony with the help of modular scales, which are based on numbers that are meaningful to your content. To summarize, you start with a ratio (like 1.618) and a number (say 10), then you multiply and divide, like so:

    10 * 1.618 = 16.180
    16.180 * 1.618 = 26.179
    26.179 * 1.618 = 42.358
    ...

    10 / 1.618 = 6.180
    6.180 / 1.618 = 42.358
    42.358 / 1.618 = 2.360
    ...

These numbers are then used throughout the design for things like font size, line height, margins, column widths, and much more. I chose the number 10 for illustration purposes, but in reality, the number should be meaningful to your design, such as the font size at which body text looks best, or the width of an image used to frame the page. And of course, numbers can be combined if you need more options.

This method is in contrast to the canvas-based way of defining grids in which the canvas, not the content, is used to build the grid. Now there is no such thing as a defined canvas on the web because websites and web apps are viewed on everything from a small mobile screen to a large desktop monitor or even a TV, which is why I find the other two methods I discussed to be better suited for the web. But between the two, I will definitely use the content-based method in my future projects because I love the fact that the numbers are meaninful to, and are derived from, the content. It just feels more "organic" to me.

# Parting Words

I'd like to conclude with a quote by Mark Boulton that nicely sums everything up:

> Aesthetics can be measured and more importantly can be constructed. If you want something to be aesthetically pleasing there are steps you can take to make sure it is going in the right direction. ... Well designed grid systems can make your designs not only more beautiful and legible, but more usable. <footer>&mdash;[Mark Boulton](http://markboulton.co.uk/journal/five-simple-steps-to-designing-grid-systems-part-2)</footer>



