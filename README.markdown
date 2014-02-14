# Readify

Readify is a responsive Octopress theme focused on readibility. It's designed to provide a pleasant reading experience on any device.

[See the demo.](http://vladigleba.com/)

# Features
- designed using a modular scale
- defined using `rem` units
- expressed with large, legible fonts
- built with Sass
- responsively designed using media queries

[Read my blog post to learn more.](http://vladigleba.com/blog/2013/10/31/introducing-readify-a-new-octopress-theme-focused-on-readibility/)

# Install

    cd octopress
    git clone https://github.com/vladigleba/readify.git .themes/readify
    rake install['readify']
    rake generate

# Variables

You can modify the following variables (defined in `sass/custom/_styles.scss`):

`$accent-color`, `$accent-hover-color`, `$text-color`, `$secondary-text-color`, `$line-color`, `$border-radius-size`, and `$hide-line-numbers` (default is `true`).

# Updating
    
    cd octopress/.themes/readify
    git pull origin master
    cd ../..
    rake install['readify']
    rake generate

# License

The MIT License

Copyright &copy; 2013 Vladi Gleba

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
