---
layout: post
title: "Using Redis for Autocomplete in Rails Apps"
date: 2014-05-28 22:29
comments: true
categories: [Rails, Storage, Phindee]
description: Learn how to use Redis to add autocomplete functionality to your Rails app.
---

A few days ago, I added search functionality to [Phindee] so users can quickly find information about a particular happy hour. Search that is well-done often comes with autocomplete, and Phindee is no exception. Autocomplete in Phindee does a couple of things for the user: 1) it reduces typing, 2) it lets the user quickly know if a specific happy hour is in the database, 3) it allows her to quickly find a particular happy hour that <em>is</em> in the database, and 4) it lets him know if the happy hour is currently happening because it will have a green circle next to it if that’s the case.

<!-- more -->

What makes this work behind the scenes is an open-source, in-memory, key-value store called [Redis](https://github.com/antirez/redis/). Because it’s in-memory, Redis is fast, which makes it perfect for autocompletion. I’ve known about Redis for a while now, but never had a need to use it, so I’m glad the opportunity finally presented itself. But now that I’ve had a chance to use it to implement autocompletion in Phindee, I’d like to explain how the entire process works behind the scenes, and hopefully, teach you a few things that will help you in your own projects.

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

You can then access the Redis command-line and by running the following:

``` bash
redis-cli
```

This allows you play around with Redis the same way that the Rails console allows you to interact with your Rails app.

Next, you’ll need to hook Redis up with your Rails app, and you can do this by adding the following line to your ‘Gemfile’:

``` ruby Gemfile
gem ‘redis’
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
        $redis.zadd "search-suggestions:#{prefix.downcase}", 1, name.downcase
      end
    end
  end
  
end
```

This creates a class called `SearchSuggestion` with a class method called `seed`. Notice that this class doesn’t inherit from `ActiveRecord::Base`, which is the base class that the models you create with `rake g model …` inherit from. We don’t need it because we’ll be using Redis instead of ActiveRecord.

By the way, we’re defining a class method instead of an instance method because the logic in this method relates to the class itself, not a specific instance of it.

Alright, now let’s go over the code. I’m looping over each record stored in the model called `Place` that contains the name of all the places that have a happy hour. 

The reason why I’m doing `Place.find_each` instead of `Place.all.each` is the `find_each` method works in batches of 1000. This means that if I have thousands of records in my database, `find_each` will load into memory only 1000 at a time, instead of loading them all at once and possibly overwhelming the server, which is the case with `Place.all.each`.

For each place, I’m using the `upto` method to loop over the place’s name n times, where n is the number of characters in the name minus 1 (you’ll understand why we’re doing minus 1 later). For example, let’s say the place name is “via delizia”. Our n value would be 10 because the length of the name is 11, but minus 1 brings it down to 10. This means we would iterate over the name 10 times.

On the first iteration, n would be 1 and the `prefix` variable would be set to the string “v” since we’re extracting the characters from 0 to 1. Then the Redis `zadd` command is used to create a Sorted Set called “search-suggestions:v” since the variable `prefix` is set to “v” on the first iteration. (I’m prefixing the set name with “search-suggestions” to keep things organized, but this is not strictly necessary). 

By the way, Sorted Sets in Redis are very similar to Sets because they both store collections of strings, but a Sorted Set also stores an associated score with each string that is then used for sorting. So if we go back to the code, you’ll see that `zadd` initializes the set “search-suggestions:v” with a score of 1 and a value of “via delizia”&mdash;the place’s full name. 

On the second iteration, a new set will be created called “search-suggestions:vi” because the variable `prefix` is set to “vi” since we’re now extracting the characters from 0 to 2. This set is also initialized to a score of 1 and a string of “via delizia”. The same process is then repeated on the subsequent iterations as well. After the 10th iteration, we’ll have 10 different sets initialized to a score of 1 and a string of “via delizia”, like so:

```
“search-suggestions:v” => [“via delizia”, 1]
“search-suggestions:vi” => [“via delizia”, 1]
“search-suggestions:via” => [“via delizia”, 1]
“search-suggestions:via “ => [“via delizia”, 1]
“search-suggestions:via d” => [“via delizia”, 1]
“search-suggestions:via de” => [“via delizia”, 1]
“search-suggestions:via del” => [“via delizia”, 1]
“search-suggestions:via deli” => [“via delizia”, 1]
“search-suggestions:via deliz” => [“via delizia”, 1]
“search-suggestions:via delizi” => [“via delizia”, 1]
```

Note that we don’t create a last set called “search-suggestions:via delizia” because there is no point in returning “via delizia” as a suggested term when a user types “via delizia”. That’s why we added the minus 1 to the length of the name. By the way, all the scores are identical right now, but they can be incremented later to increase the ranking of popular search terms.

Let’s now assume the second place name is “vault martini”. This means that on the very first iteration for “vault martini”, with the `prefix` variable set to “v”, there will be no new set created since we already have a set called “search-suggestions:v”. `zadd` will recognize this and add to the already existing set, instead. This means that the set “search-suggestions:v” will now hold two keys:

```
“search-suggestions:v” => [[“via delizia”, 1], [“vault martini”, 1]]
```

And now you can see how autocompletion will work. Whenever a user types “v” in the search bar, we can return a list of search suggestions simply by returning the values in the “search-suggestions:v” set. There is no need for expensive queries that search through the entire database and look for matches. Instead, we find what we’re looking for instantly. This is the beauty of Redis (and other key-value stores).

But how do we extract values from a set? Well, Redis has a command called `zrevrange` that does just that. It returns a ———-----HERE———-----

``` ruby search_suggestion.rb
. . .
  def self.terms_for(prefix)
    $redis.zrevrange "search-suggestions:#{prefix.downcase}", 0, 9
  end
. . .
```

Next, we’ll need to create a controller that will take the search phrase the user typed in and return a list of suggestions:

``` bash
rails g controller search_suggestions
```

Open the newly created `search_suggestions_controller.rb` file and add the following code inside the `SearchSuggestionsController` class:

``` ruby search_suggestions_controller.rb
. . .
  def index
    render json: SearchSuggestion.terms_for(params[:term])
  end
. . .
```

This creates an `index` method that will return a JSON response 