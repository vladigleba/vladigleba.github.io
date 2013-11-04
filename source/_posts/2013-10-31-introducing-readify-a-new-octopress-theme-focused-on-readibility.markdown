---
layout: post
title: "Introducing Readify: A New Octopress Theme Focused on Readibility"
date: 2013-10-31 09:20
comments: true
categories: [Open Source, Sass, Design]
---

Hackers using the [Octopress blogging framework](http://octopress.org/) now have a new responsive theme available focused on readability! It's called [Readify](https://github.com/vladigleba/readify).

<!-- more -->

# Background

Readify was born out of a desire for a simple, minimalist theme that made the reading experience as pleasurable as possible. There are a couple of minimalist Octopress themes already out there, among them [Whitespace](https://github.com/lucaslew/whitespace), the inspiration behind Readify, but I could not find a theme focused on providing a nice reading experience. So I built Readify to fill in that gap.

# Designed Using a Modular Scale

Before building Readify, I spent some time studying the designs and the underlying code of the various blogs I follow. I ended up learning [quite a bit](http://vladigleba.com/blog/2013/10/22/ways-to-define-a-grid-system/). I read many articles, but the one that resonated with me the most was A List Apart's <cite>[More Meaningful Typography](http://alistapart.com/articles/more-meaningful-typography/)</cite> article; it explained how to use values from a modular scale to build meaningful compositions and achieve visual harmony. I definitely wanted to use this technique with Readify.

My modular scale was based on the [golden ratio](http://en.wikipedia.org/wiki/Golden_ratio) (1:1.618) and the numbers 20 and 62. I picked the golden ratio because I had just read about it a week earlier when learning about grid systems and was impressed by its occurance in everything from music to architecture to nature. It is known to provide pleasing, visually harmonious proportions, and that's exactly what I wanted for Readify. With regards to picking the two other numbers, 20 was the font size in pixels at which my body text looked most readable, and 62 was the size at which the blog's title looked best. Not very scientific, but it worked. 

I then plugged these two numbers, along with the golden ratio, into the calculator at [modularscale.com](http://modularscale.com/), and I had my modular scale. A majority of the font size, line lenght, margin, and padding values come directly from the numbers in the scale. When I needed more options than the scale offered, I ended up adding or subtracting the numbers from the scale for more flexibility.

# Defined Using `rem` Units

If you look at the actual values though, you'll notice that they are specified in a unit called 'rem'. It's similar to the `em` unit, but the difference is the `em` is calculated based on the value of the parent element, while the `rem` is based on the value of the top-level root element, which is usually the `html` element. This means that if the entire layout is `rem` based, changing the `html` element's font size means the layout will also proportionally readjust itself. So if one day you decide to increase your body text size by 5%, you will no longer need to manually readjust all the other font sizes, line heights, margins, and paddings to preserve the layout proportions; all you need to do is increase the `html` element's font size! Pretty nifty stuff.

But of course, there is one caveat. Older browsers do not support `rem` units, so it's best to include the pixel equivalents as well. This adds code bloat, of course, but if `rem` units are right for your project, then I think it's worth it.

# Expressed in Legible Fonts

I ended up using the same fonts as those used by the Whitespace theme. They contrast nicely with each other, and the [PT Serif](https://www.google.com/fonts/specimen/PT+Serif) font looks stunning when used in body text. I don't have a scientific explanation for this, but I always prefer body text to be in a serif font compared with a sans serif one, as I find serif fonts easier to read. But it's easy to change if you prefer the other.

With regards to font size, small sizes on the web are a pet peeve of mine. I hate moving closer to the screen or increasing the font size just so the content is readable. That's why I made Readify's body font size a comfortable 20 pixels.

# Built with Sass

I chose to use the Sass stylesheet language, instead of CSS, because I like using variables in my stylesheets. Instead of doing a document-wide find and replace, I can just change the variable once, and it all propagates everywhere else. I also like the nesting functionality, which saves me quite a bit of typing. And finally, Sass comes with built in `lighten()` and `darken()` functions. This means I can use a single color to derive multiple other colors, and that means less maintenance when it's time to change the color scheme.

And of course, Readify is built with media queries, so it looks stunning&mdash;and readable&mdash;on all devices. 

If you think Readify is something you might enjoy, head on over to GitHub and [give it a try](http://github.com/)! And feel free to offer feedback! This is my first open source project, so I'd love to read your comments.