---
layout: post
title: "Using @font-face with Ruby on Rails"
date: 2013-11-29 11:35
comments: true
categories: [Rails, Design, Phindee]
description: Learn how to use @font-face to add custom fonts to your Ruby on Rails app.
---

When I was working on [Phindee](http://phindee.com/), I struggled with adding custom fonts; the asset pipeline had just been released, and it changed how one worked with assets. Perhaps there are others out there struggling with the same thing, which is why I’d like to share what I did and hopefully save some time for a few.

<!-- more -->

I'll be using [Font Squirrel](http://www.fontsquirrel.com/) to generate the necessary font files, but there are other alternatives out there like [Google Fonts](https://www.google.com/fonts/) and [Typekit](http://typekit.com/), which are easier to set up because they host the fonts for you on their own servers. The down side is if their servers go down so do your fonts. With Font Squirrel this is not the case because the fonts live directly on your own servers. This makes the setup a bit more involved, but hey, it's a learning opportunity, and the pay off is well worth it.

Alright, let's get to work.

# Setup

First thing we’ll do is add a new directory called “fonts” to the `app/assets` directory; this is where we’ll place all our font files. I usually use Font Squirrel to generate these files, as they have hundreds of open source fonts to choose from; if you find a font you like, you can get access to the font files by downloading the font’s Webfont Kit, which includes all four major font formats (TTF, EOT, WOFF, and SVG). This means your fonts will be cross-browser compatible, as each major browser now supports at least one of the four formats.

Once we have our font files downloaded, we’ll add them to `app/assets/fonts`. 

# Declaring Your Fonts

Alright, we’re now ready to declare our fonts. In order to keep our code organized, we’ll add a new `fonts.css.scss` file to `app/assets/stylesheets`, and we’ll make our `@font-face` declarations right inside it. (Note that I use the SASS pre-compiler; hence, the additional `.scss` extension.) 

Since I downloaded my fonts from Font Squirrel, I already have my font declarations pre-written for me. All I need to do is open the Webfont Kit I downloaded earlier, find the `stylesheet.css` file, and copy and paste the code into the `font.css.scss` file I just created above. If you didn’t use Font Squirrel, you’ll need to write the declarations yourself. You can follow the examples at [fontspring.com](https://www.fontspring.com/blog/the-new-bulletproof-font-face-syntax) for guidance.

I downloaded Font Squirrel’s "Action Man" font as an example, and below is the `@font-face` declaration that came with it.

``` scss fonts.css.scss
@font-face {
    font-family: 'action_manregular';
    src: asset-url('Action_Man-webfont.eot');
    src: asset-url('Action_Man-webfont.eot?#iefix') format('embedded-opentype'),
           asset-url('Action_Man-webfont.woff') format('woff'),
           asset-url('Action_Man-webfont.ttf') format('truetype'),
           asset-url('Action_Man-webfont.svg#action_manregular') format('svg');
    font-weight: normal;
    font-style: normal;
}
```

Note that the above declaration uses the `url()` methods by default to specify the font’s location. In order to make this work with the Rails Asset Pipeline, you’ll want to change those methods to `asset-url()`, or the fonts might not load.

Now all that's left is to declare our font inside whatever CSS file is appropriate using the `font-family` property, like so: 

``` scss base.css.scss
p { font-family: 'action_manregular'; }
```

Note that my font name matches the font name inside the `@font-face` `font-family` declaration. If names don’t match exactly, it might not work.

# And That's a Wrap

Believe it or not, that’s all there is to it! If you refresh your browser, you should be able to see the new fonts in action. If that’s not the case, double check to make sure you’re using the `font-url()` methods if you’re running a pre-compiler like SASS or LESS, and make sure your `font-family` declarations match your `@font-face` declarations to the tee, including little things like capitalization, hyphens, underscores, etc. If that doesn't do it then Google might be your best bet.