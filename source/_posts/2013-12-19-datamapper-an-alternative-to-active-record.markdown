---
layout: post
title: "DataMapper: An Alternative to Active Record"
date: 2013-12-19 11:27
comments: true
categories: [DataMapper, Active Record, Ruby, Storage]
---

I recently finished working on a Ruby script that needed to store a small amount of data in a database. Having previously worked with [Active Record](http://guides.rubyonrails.org/active_record_querying.html), I loved the idea of an Object Relational Mapper written in Ruby; it makes manipulating data easy and keeps your code organized. Active Record, however, was definitely an overkill for such a small project. I needed something simple, lightweight, and easy to set up.

<!-- more -->

Naturally, I went to Google for advice. A few searches in and I realized that one ORM was showing up in my search results consistently&mdash;DataMapper. Since I had never used it before, I went over to the DataMapper website to [learn more](http://datamapper.org/why.html). It made some impressive promises, but nothing sold me more than the fact that I didn’t have to deal with migrations. While they are useful for large projects with multiple developers, they just seemed like a chore for my small Ruby script.

Now having spent a few days working with it, I’d like to share how it compares to Active Record.

# Setup

We setup DataMapper with the following line:

``` ruby script.rb
DataMapper::setup(:default, "sqlite3://#{Dir.pwd}/ba.db")
```
This specifies an SQLite database connection and sets the path to the database file. Of course, you can setup other database connections, like MySQL or PostgreSQL, but I chose SQLite because it was more than enough for my little script. And that one line above is actually all the setup we need!

# Migration-Free

As I already mentioned, DataMapper doesn’t require you to write migrations, though [you can if you want](https://github.com/datamapper/dm-migrations). Instead, you can generate a schema simply by calling either `auto_migrate!` or `auto_upgrade!`. The former destructively drops and recreates your tables, while the latter upgrades your tables without destroying already existing data. 

The schema is created based on model definitions, which look like so:

``` ruby script.rb
class User  
  include DataMapper::Resource

  property :id, Serial
  property :email, String, unique: true, format: :email_address
  property :created_at, DateTime
  property :updated_at, DateTime

  validates_presence_of :email
end
```

This creates a User model definition with four attributes: `:id`, `:email`, `:created_at`, and `:updated_at`. (Unlike Active Record, DataMapper doesn't create the `:created_at` and `:updated_at` attributes by default.) The attribute name and type are defined using the `property` keyword.

The code above then adds [validations](http://datamapper.org/docs/validations.html) using either the auto-validation methods, which we specify in the same line as our property declaration, or the manual validation methods, which we specify right below our property declarations. Only the four most common validations are implemented as auto-validation methods: `required`, `unique`, `length`, and `format`; all the other ones are implemented as manual validation methods.

Once we have our models defined, all we have left to do is finalize them:

``` ruby script.rb
DataMapper.finalize.auto_upgrade!
```

The `finalize` method runs the validations and initializes the properties, while the `auto_upgrade!` method will create new tables, if necessary, and add columns to existing tables, but it won’t change any existing columns. If you want to destructively drop and recreate your tables, use the `auto_migrate!` method instead.

Believe it or not, that’s all there is to it! After we run `auto_upgrade!`, our database is ready to go.

# Performant by Default

One last thing I’d like to mention is that DataMapper is built to be performant by default. It does this, for example, by issuing the minimum possible number of queries by default, unlike Active Record, which requires the use of the `includes` method to do so. DataMapper also lazy-loads your queries, which means it waits until the very last second to actually issue the query. (Active Record has been doing this since Rails 3.)

Of course, DataMapper comes with other standard features you’d expect from an ORM, like callbacks, associations, chaining, and single table inheritance. It supports most major SQL databases, but it can also map object models to YAML, JSON, XML, and CSV. Feel free to read over the [documentation](http://datamapper.org/docs/) to get a sense of all of its capabilities.

# The Verdict

DataMapper is a great persistent storage solution for Ruby scripts. It's simple, lightweight, and takes just a couple of lines to have everything setup and ready to go. DataMapper does what it does well and gets out of the way, which means you can go back to writing actual code. Of course, if I was developing a real Rails application, I’d probably use Active Record, as it’s more robust and battle-tested, but DataMapper was a perfect fit for my Ruby script.

It’s worth noting that I’m using DataMapper version 1.2.0 above, the latest stable release, which is no longer actively developed because focus has shifted to version 2, which is now called [Ruby Object Mapper](http://rom-rb.org/) (ROM). The first version of ROM was released just [a few months ago](https://twitter.com/rom_rb/statuses/370985979554721792), and I don't know if it’s battle-tested enough for actual use in projects.