---
layout: post
title: "How to Do Autocomplete in Rails Using Redis"
date: 2014-05-30 10:40
comments: true
categories: [Databases, Phindee]
description: Learn how to use Redis to add autocomplete functionality to your Rails app.
---

A few days ago, I added search functionality to [Phindee](http://phindee.com/) so users can quickly find information about a particular happy hour. Search that is well-done often comes with autocomplete, and Phindee is no exception. 

<!-- more -->

Autocomplete in Phindee does a couple of things for the user: 1) it reduces typing, 2) it lets the user quickly know if a specific happy hour is in the database, 3) it allows her to quickly find a particular happy hour that <em>is</em> in the database, and 4) it lets him know if the happy hour is currently happening because it will have a green circle next to it if that’s the case.

What makes this work behind the scenes is an open-source, in-memory, key-value store called [Redis](https://github.com/antirez/redis/). Because it’s in-memory, Redis is fast, which makes it perfect for autocompletion. I’ve known about Redis for a while now, but never had a need to use it, so I’m glad the opportunity finally presented itself. But now that I’ve had a chance to work with it, I’d like to explain how the autocomplete functionality works behind the scenes, and hopefully, teach you a few things for your own projects.

Before we go on, it’s important that you have a basic understanding of Redis. If you’re never used it before, I recommend going through the [interactive tutorial](http://try.redis.io/) on their website; it will help you understand what it’s for, what it can do, and how to use it. Pay special attention to the section on sorted sets because that’s what we’ll be using for autocompletion. 

# Installing Redis

If you’re on a Mac, you can easily install Redis using [Homebrew](https://github.com/Homebrew/homebrew) by running the following command:

``` bash
brew install redis
```

When it finishes, it’ll give you the command to start the Redis server:

``` bash
redis-server /usr/local/etc/redis.conf
```

You can then access the Redis command-line by running `redis-cli`, which allows you to play around with various Redis commands to see how they work.

Next, you’ll need to hook Redis up with your Rails app, and you can do this by adding the following line to your ‘Gemfile’:

``` ruby Gemfile
gem 'redis', '~> 3.0.7'
```

Then run `bundle` to install it.

# Defining a Model for Redis to Work With

First thing we’ll need to do is create an initializer file for setting up our Redis connection. Go ahead and create a file called `redis.rb` inside your app’s `/config/initializers` directory. Then add the following line into it:

``` ruby redis.rb
$redis = Redis.new
```

This creates a global variable called `$redis` to make it easy for us to access Redis through out our app.

Next, we’ll create a new file called `search_suggestion.rb` inside the `/app/models` directory. It will contain the code that seeds our Redis database and retrieves a list of suggestions. To start things off, add the following code into it:

``` ruby search_suggestion.rb
class SearchSuggestion
  
  def self.seed
    Place.find_each do |place|
      name = place.name
      1.upto(name.length - 1) do |n|
        prefix = name[0, n]
        $redis.zadd 'search-suggestions:#{prefix.downcase}', 1, name.downcase
      end
    end
  end
  
end
```

This creates a class called `SearchSuggestion` with a class method called `seed()`. Notice that this class doesn’t inherit from `ActiveRecord::Base`, which is the base class that the models you create with `rails g model ...` inherit from. We don’t need it because we’ll be using Redis instead of ActiveRecord. (By the way, we’re defining a class method instead of an instance method because the logic in this method relates to the class itself, not a specific instance of it.)

## Code Walk-Through

Alright, now let’s go over the code. Phindee has a model called `Place` for storing all the places that have a happy hour, and I’m simply looping over each record stored in it. The reason why I’m doing `Place.find_each` instead of `Place.all.each` is the `find_each()` method works in batches of 1000. This means that if I have thousands of records in my database, `find_each()` will load into memory only 1000 at a time, instead of loading them all at once and possibly overwhelming the server, which is the case with `Place.all.each`.

For each place, I’m using the `upto()` method to loop over the place’s name n times, where n is the number of characters in the name minus 1 (you’ll see why we’re doing minus 1 later). For example, let’s say the place name is “via delizia”. Our n value would be 10 because the length of the name is 11, but minus 1 brings it down to 10, so we would iterate over the name 10 times.

On the first iteration, n would be 1 and the `prefix` variable would be set to the string “v” since we’re extracting the characters from 0 to 1. Then the Redis [`ZADD` command](http://redis.io/commands/zadd) is used to create a Sorted Set called “search-suggestions:v” since the variable `prefix` is set to “v” on the first iteration. (I’m prefixing the set name with “search-suggestions” to keep things organized, but this is not strictly necessary). 

Sorted Sets are very similar to Sets because they both store collections of strings, but a Sorted Set also stores an associated score with each string that is then used for sorting. So if we go back to the code, you’ll see that `ZADD` initializes the set “search-suggestions:v” with a score of 1 and a value of “via delizia”&mdash;the place’s full name. 

On the second iteration, a new set will be created called “search-suggestions:vi” since we’re now extracting the characters from 0 to 2, and this initializes the variable `prefix` to “vi”.  The set itself is then initialized to a score of 1 and a string of “via delizia”, just like the first time.

The same process is then repeated on the subsequent iterations as well. After the 10th iteration, we’ll have 10 different sets initialized to a score of 1 and a string of “via delizia”, like so:

``` bash
'search-suggestions:v' => ['via delizia', 1]

'search-suggestions:vi' => ['via delizia', 1]

'search-suggestions:via' => ['via delizia', 1]

'search-suggestions:via ' => ['via delizia', 1]

'search-suggestions:via d' => ['via delizia', 1]

'search-suggestions:via de' => ['via delizia', 1]

'search-suggestions:via del' => ['via delizia', 1]

'search-suggestions:via deli' => ['via delizia', 1]

'search-suggestions:via deliz' => ['via delizia', 1]

'search-suggestions:via delizi' => ['via delizia', 1]
```

Note that we don’t create a last set called “search-suggestions:via delizia” because there is no point in returning “via delizia” as a suggested term when a user types “via delizia”. That’s why we added the minus 1 to the length of the name.

By the way, all the scores are identical right now, but they can be incremented later to increase the ranking of popular search terms, although I won't be covering how to do this here.

Let’s now assume the second place name is “vault martini”. This means that on the very first iteration, with the `prefix` variable set to “v” once again, there will be no new set created since we already have a set called “search-suggestions:v”. `ZADD` will recognize this and add to the already existing set, instead. This means that the set “search-suggestions:v” will now hold two keys:

```
'search-suggestions:v' => [['via delizia', 1], ['vault martini', 1]]
```

And now you can see how autocompletion will work. Whenever a user types “v” in the search bar, we can return a list of search suggestions simply by returning the values in the “search-suggestions:v” set. There is no need for expensive queries that search through the entire database and look for matches. Instead, we find what we’re looking for right away. That's the beauty of Redis (and other key-value stores).

## Extracting Values from a Sorted Set

But how do we extract values from a set? Well, Redis has a command called [`ZREVRANGE`](http://redis.io/commands/zrevrange) that does just that. It returns a range of elements sorted by score (with the highest scores listed first). Go ahead and add the following to `search_suggestion.rb`:

``` ruby search_suggestion.rb
. . .

  def self.terms_for(prefix)
    $redis.zrevrange 'search-suggestions:#{prefix.downcase}', 0, 9
  end
  
. . .
```

This function accepts a `prefix` variable and uses `ZREVRANGE` to return the first 10 elements of a sorted set containing the specified `prefix` value. We'll use it later to return a list of search suggestions to the user.

# Creating a Rake Task to Seed Redis

In order to make it easy for us to seed Redis from the command line, we'll create a [Rake](https://github.com/jimweirich/rake) task that calls the `seed()` method we defined earlier. (If you're new to Rake, I highly recommend watching the [Railscasts episode](http://railscasts.com/episodes/66-custom-rake-tasks) about it.) Go ahead and create a new file called `search_suggestions.rake` inside your app's `/lib/tasks` directory, and add the following into it:

``` ruby search_suggestions.rake
namespace :search_suggestions do
  
  desc 'Generate search suggestions'
  task index: :environment do
    SearchSuggestion.seed
  end
  
end
```

The code is simple. We're creating a task called `index` and making it dependent on a Rake task provided by Rails called `environment`, which loads the Rails environment and gives us access to our `SearchSuggestion` class. Then we're just calling the `seed()` method we defined earlier to seed Redis. (We wrap this up inside a namespace called `search_suggestions` to keep things neat and organized.)

And now we can `cd` into our app's root directory and call this task from the command line, like so:

``` bash
rake search_suggestions:index
```

You can then go into the Rails console with `rails c` and run some Redis commands to see if it worked. For example, if I defined a set called "search-suggestions:v" earlier, I can run the `ZREVRANGE` command to return the first 10 elements:

``` bash
$redis.zrange 'search-suggestions:v', 0, 9, with_scores: true
=> [["vault martini", 1.0], ["via delizia", 1.0], ["vino bar", 1.0]]
```

Note that if you want Redis to return the values along with their scores, you need to pass an argument called `with_scores` and set it to `true`; otherwise, Redis omits the scores.

# Setting Up the Front-End

Now that we have the back-end functionality setup, it’s time to set up the front-end. We’ll use the jQueryUI [autocomplete widget](http://api.jqueryui.com/autocomplete/) due to its simplicity and ease of use. We could include it in our app simply by adding the following to our `/app/assets/javascripts/application.js` file:

``` javascript application.js
//= require jquery-ui
```

but this will include the entire library with all the widgets. I don’t like code bloat and prefer to include only the code that I actually need, so we'll take another route.

## Keeping Things Slim

Head over to the jQueryUI [download page](http://jqueryui.com/download/) and under “Components”, deselect the “Toggle All” option, which will deselect all the checkboxes. Then scroll down to the “Widgets” section, select “Autocomplete”, and you’ll see a few other necessary dependencies get selected automatically. Then press “Download”.

If you open the folder it downloaded and go into its `/js` directory, you’ll see a file that starts with “jquery-ui-” and ends with a “.custom.js” extension.  Open it and copy its code. Then head over to your app, create a new file called `autocomplete.js` inside the `/app/assets/javascripts` directory, and paste that code into it.

Now go back to the folder you just downloaded, go into its `/css` directory, find a file with a “.custom.css” extension, open it, and copy its code. Then create another file called `autocomplete.css` inside your app’s `/app/assets/stylesheets` directory and paste the code into it.

Now we have the code we need and no more.

## Hooking It up with HTML

We're ready to connect the autocomplete code we just added to our app's HTML. In Phindee, I have a simple form with a search image and an input field that needs the autocomplete functionality:

``` erb
. . .

<form class="search-form”>
  <%= image_tag asset_path('search-icon.svg'), class: 'search-icon' %>
  <input type="text" class=“search-field" />
</form>

. . .
```

In another file, I have the following CoffeeScript code that hooks up the autocomplete widget to the input field I just mentioned above:

``` coffeescript 
. . .

  $('.search-field').autocomplete
    appendTo: '.search-form',
    source: '/search_suggestions'
    
. . .
```

I’m simply calling the jQueryUI-provided `autocomplete()` method on the input field I'm interested in. I then use the `appendTo` option to specify that the autocomplete drop-down should be appended to the form itself. Finally, I’m using `source` to specify the URL path the autocomplete widget will use to get a list of search suggestions that will be displayed in the drop-down. I chose a path called “/search_suggestions”, but you can choose any path you want.

## How It Works

If you look at the [documentation](http://api.jqueryui.com/autocomplete/#option-source) for `source`, you’ll see that it can accept the search suggestions as an array of strings, a string pointing to a URL that <em>returns</em> an array of strings, or a function with a response callback that also returns an array of strings. We’re using a string pointing to a URL since this fits our needs perfectly.

This is how it will work. The widget will take whatever is typed in the search field and append it to a variable called “term”, which itself will get appended to the URL path we specified in `source`. Then it’ll make a GET request to the URL and expect our server to respond with the search suggestions rendered as an array of strings in the JSON format. So for example, if the user types in “v”, the widget will make a GET request to “/search_suggestions?term=v”, and it’ll expect the server to respond with something like `["via delizia","vault martini”]`.

Our server doesn’t yet know how to respond to a URL like this. Let’s set it up.

# Creating a Controller to Handle Requests

First, we’ll create a controller that takes the search phrase the user types in, passes it on to the `terms_for()` method we defined in `search_suggestion.rb`, and returns the resulting list of suggestions back to the user. We'll call it `search_suggestions`:

``` bash
rails g controller search_suggestions
```

This will create a new file called `search_suggestions_controller.rb`. Open it and add the following code inside the `SearchSuggestionsController` class:

``` ruby search_suggestions_controller.rb
. . .

  def index
    render json: SearchSuggestion.terms_for(params[:term])
  end
  
. . .
```

We extract the value of the `term` variable using `params[:term]`, pass it on to the `terms_for()` method, and tell Rails to render the response in JSON format. Kid stuff.

Then open your app’s `/config/routes.rb` file and add the following line into it:

``` ruby routes.rb
. . .

  match '/search_suggestions', to: 'search_suggestions#index', via: :get
  
. . .
```

This maps our `index` controller to the path we specified earlier in `source`, and our server now knows how to respond to a URL like "/search_suggestions?term=v".

I think we’re ready for the moment of truth. Restart the rails server, type something in the search field, and if all is well with the world, you should see a drop-down menu with a list of search suggestions. If you don’t, you'll need to do some debugging to figure out what's wrong.

# Making It Work on a VPS

Installing Redis on a VPS isn’t as easy as running `brew install redis`, but it’s not too bad. DigitalOcean has a [nice tutorial](https://www.digitalocean.com/community/articles/how-to-install-and-use-redis) on the subject. I used it myself to get Redis installed on the server running Phindee, and it worked without a hiccup. I highly recommend it.

Once you have it installed, you’ll need to run the `index` task we wrote earlier to seed the database with data. If you’re using Capistrano, you can use the following task to run it from your local computer:

``` ruby
desc 'Seed the redis database (search suggestions)'
task :seed_redis do
  on roles(:app) do
    within '#{current_path}' do
      with rails_env: :production do
        execute :rake, 'search_suggestions:index'
      end
    end
  end
end
```

If you’re new to Capistrano, feel free to read through an [earlier post]({{ root_url }}/blog/2014/04/10/deploying-rails-apps-part-6-writing-capistrano-tasks/) I wrote, which explains what it is and how you can use it. Or if you’re new to deployment in general, you’re welcome to go through my [6-part series]({{ root_url }}/blog/2014/03/05/deploying-rails-apps-part-1-securing-the-server/), which covers everything from setting up and securing a server to configuring Nginx, Unicorn, and Capistrano.

Alright, that's all I have. Stay hungry. Stay foolish.

