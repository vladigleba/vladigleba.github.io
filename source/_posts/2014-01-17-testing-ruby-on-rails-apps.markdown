---
layout: post
title: "Testing Ruby on Rails Apps"
date: 2014-01-17 12:35
comments: true
categories: [Rails, Testing, Test Unit]
---

I started learning Ruby on Rails over a year ago, and as most beginners, I chose the popular <cite>[Ruby on Rails Tutorial](http://ruby.railstutorial.org/ruby-on-rails-tutorial-book)</cite> as my initial guide. Because there was so much new material to absorb, I decided to skip the sections about testing (and I’m glad I did or my head would’ve exploded). When I finished the book, I decided to build a Rails app called [phindee](http://phindee.com/) in order to solidify what I had just learned. I never went back to learn about testing, however. Now over a year later, I did just that and was finally able to write a solid test suite for the app.

<!-- more -->

To be honest, I was a bit reluctant to pickup testing at first. I knew it was important to test code (and I did that by sprinkling `print` statements all over my code), but it was never a part of my workflow. When I got into the zone, the last thing I wanted to do is slow down and write tests. Over the past couple of days, however, I finally saw the light. And it was glorious. 

Let me share it with you.

# Test-Driven Development

Test-driven development (TDD) is an approach to software development in which we first write a test for a desired functionality, then run the test to make sure it fails, and only then do we implement the said functionality. Once implemented, we run the test once more to make sure our implementation behaves the way our test says it should.

We write and run a failing test first for two reasons: 

1. it helps guide our implementation due to the fact that we’ve already identified what the result should look like, and
2. it makes sure that the test is actually covering the functionality we think it is, because it’s easy to write a test that doesn’t really check what we think its checking

The benefits of TDD are many, but the way I see it, it boils down to three main ones: peace of mind, saved time, and better code.

## Peace of Mind

How many times have you found yourself wanting to refactor an ugly mess of code, but due to the fear of breaking things, you ended up ditching the effort all together? This happens to me all the time, and I hate it. It doesn’t need be this way though. Since adding test cases to phindee, I’ve refactored more than half of my helper functions without any worry of breaking things.

But it gets better. Testing not only allows you to refactor with confidence, you also get to deploy with confidence, and this comes as part of the package, without any additional effort.

This kind of peace of mind is possible because a test suite catches bugs in your code like no other. You don’t even need to write a large number of tests to reap the rewards; a few well-written test cases can go a long way.

## Saved Time

Let me ask you this: Would you rather run a command that looks for bugs in your code on demand, and tells you exactly where to look if it finds them, or would you rather have your users discover the bugs in production, thereby sending you on a frantic bug-hunting spree? It’s a no brainer, yet all too often we find ourselves discovering bugs in production when they could’ve easily been discovered in development.

The beauty with having a test suite is you write your tests once, and running them on demand is as simple as typing a short command. The amount of time this saves is enormous. Of course, I’m not saying that writing test cases means you’re production environment will be bug free because software is never bug free; but it <em>will</em> help you track down <em>most</em> bugs <em>before</em> they reach production and do so in a fraction of the time it would’ve taken otherwise.

## Better Code

Now that phindee is backed up by a solid test suite, my code has drastically improved in quality because I was finally able to refactor it. It’s simpler, and there is now less of it.

Furthermore, having to write test cases for individual methods has also forced me to write simpler, decoupled methods. You see, it’s hard to write test cases for methods that do more than one thing and happen to be entangled with one another. And this is the reason why test cases lead to cleaner, simpler code. As a result, tracking down bugs is even easier, which means more saved time.

# How It’s Done

Now that we’ve covered the benefits, I’d like to show you how easy it is to do the testing. Note that I will be using the testing library called Test Unit that ships by default with Rails, instead of the RSpec framework used by the <cite>Ruby on Rails Tutorial</cite>. (I’ll discuss why a bit later.) 

Rails provides directories for five different categories of tests by default: helper tests, unit tests (directory is called `models`), functional tests (directory is called `controllers`), mailer tests, and integration tests. But before I go into them, I first need to introduce fixtures.

## Fixtures

Fixtures are defined in YAML files, and their role is to initialize our models with sample data for the sole purpose of testing. They allow us to then easily use this data in our test cases without corrupting our development database. As an example, below is a fixture file for a model in phindee called `Place`:

``` yaml places.yml
thai:
  name: Thai Chili Jam
  website: thaichilijam.com

grill:
  name: Portland Sports Bar and Grill
  website: portlandsportsbarandgrill.com
```

Here I created two instances of the `Place` model (`thai` and `grill`) and initialized their `name` and `website` attributes. The data is now ready to be used in our test cases. Because YAML is beyond the scope of this post, I won’t go into any more detail, but I encourage you to [learn more](http://yaml.org/YAML_for_ruby.html).

Now that we know about fixtures, we’re ready to learn about the different types of tests we can write for a Rails app. To better explain each type, I will show examples from phindee.

## Helper Tests

Helper tests are just what they sound like&mdash;they’re tests for your helper methods. When you create a controller using the `rails generate controller NAME` command, Rails automatically creates a `NAME_helper_test.rb` file inside `test/helpers` to write the tests in. Below is what one of my helper tests for phindee looks like:

``` ruby happy_hours_helper_test.rb
  . . .
  
  test 'should return days given integers' do
    assert_equal humanize_days('2'), 'monday'
    assert_equal humanize_days('1-5'), 'sunday-thursday'
    assert_equal humanize_days('3,4,7'), 'monday, wednesday, saturday'
  end
  
  . . .
```

The `assert_equal` method makes sure that `humanize_days(‘2’)` returns a string with a value of `’monday’`; if it doesn’t, it will raise an error. Because the `humanize_days` method understands three different string formats, I test each one once. If one of the three calls fails, it will tell me exactly which one failed, thereby making debugging easier. All it takes is three lines of code, and my method is fully tested.

In practice, we would typically first write these tests, run them to make sure they’re failing, and only then would we start their implementation.

## Unit Tests

Unit tests are there to test your models. The `rails generate model NAME` command creates a file for these tests called `NAME_test.rb` inside the `test/models` directory. Below are two tests from phindee for an attribute called `location_id`:

``` ruby happy_hour_test.rb
  . . .
  
  def setup 
    @place = places(:thai) 
  end

  test 'should be invalid if name is missing' do
    @place.name = nil
    assert !@place.valid?
  end
  
  test 'should be invalid if name exceeds max length' do
    @place.name = 'a' * 51
    assert !@place.valid?
  end
  
  test 'should be invalid if name is not unique' do
    identical = @place.dup
    assert !identical.valid?
  end
  
  . . .
```

The `setup` method is not an actual test case; it’s just a method that gets called before each test case is executed. It simply initializes an instance variable called `@place` with the fixture we defined earlier called `thai`. This makes the `@place` instance variable available inside each subsequent test case.

The first test case sets the `name` attribute to `nil` and calls the `assert` method to check that the `valid?` method returned `false`. In other words, it's checking for the line below:

``` ruby place.rb
validates :name, presence: true
```

The second test makes sure that a `name` attribute that exceeds the maximum length of 50 characters is not valid. This means it will look for a `length` helper with a `maximum` value set to 50, like so:

``` ruby place.rb
validates :name, presence: true, length: { maximum: 50 }
```

And finally, the third test makes sure that duplicates are not valid, which means it'll look for a `uniqueness` helper set to `true`: 

``` ruby place.rb
validates :name, presence: true, length: { maximum: 50 }, uniqueness: true
```

You may be wondering what’s the point of all this? Well, if you ever accidentally delete a uniqueness declaration, for example, the test suite will let you know, and you will be able to fix it before you push your code to production and wreak havoc in your database.

## Functional Tests

Functional tests are there to test your controllers, although you can also use them to test your views and verify that important HTML elements are present. Running `rails generate controller NAME` creates a file for these tests called `NAME_controller_test.rb` inside `test/controllers`. Let’s look at an example:

``` ruby happy_hour_controller_test.rb
  . . .
  
  test "should get happening_now" do    
    get :happening_now          # simulates a get request on happening_now action
    assert_response :success    # makes sure response returns with status code 200
    
    # variables
    assert_not_nil assigns(:happening_now)
    assert_not_nil assigns(:geojson)
    
    # header
    assert_select '.intro h1', 'phindee' 
    assert_select '.intro p', /.+/  # regex makes sure element is not empty
    
    # definition list
    assert_select 'article dl img', count: 2  # must be two img elements
    
    # list items
    assert_select 'article li p', /#{humanize_hours(assigns(:happening_now).first.start_time)}/
    assert_select 'article li h2', assigns(:happening_now).first.location.place.name
  end
  
  . . .
```

The `assert_not_nil` method makes sure the variable that the `assigns` method retrieves is actually initialized. Note that `:happening_now` and `:geojson` are instance variables inside the controller, but here they're symbols. 

All the other remaining assertions use the `assert_select` method to select an HTML element using the familiar CSS syntax and make sure it’s value is what we expect it to be. As you can see, the method is quite powerful; it can check for a specific string, evaluate a regular expression, and check for a certain number of elements using the `count` method, among [other things](http://api.rubyonrails.org/classes/ActionDispatch/Assertions/SelectorAssertions.html).

I’m only scratching the surface here of what’s possible with functional tests, and I encourage you to check out the official [Rails guide on testing](http://guides.rubyonrails.org/testing.html) to learn more.

## Mailer Tests

As you might guess, mailer tests are there to test mailer classes. A `NAME_mailer_test.rb` file is created inside `test/mailers` anytime you run `rails generate mailer NAME`. You can test your mailers in two different ways:

1. test the mailer in isolation to make sure its output is what you expect (using unit tests)
2. test the controllers and models that use the mailers to make sure the right email is sent at the right time (using functional tests)

When testing your mailers with unit tests, you’ll use fixtures to provide sample data demonstrating how the output should look. I don’t have any examples of mailer tests to show because I have not yet needed to implement email functionality for phindee, but the [Rails guide](http://guides.rubyonrails.org/testing.html) should give you a good feel for what they look like.

## Integration Tests

Last but not least, we have integration tests, which are used to test controllers interacting with one another; they’re the “big picture” tests that make sure important workflows within your application are as bug free as possible. I haven’t written any integration tests for phindee either because the app is simple enough that I only need one controller currently, but that will change in the near future, and I will update this section accordingly; in the meantime, feel free to see the [Rails guide](http://guides.rubyonrails.org/testing.html) for examples.

One final thing I’d like to mention is the `test/test_helper.rb` file, which holds the default configuration for our tests. This file is included in all the tests, which means any methods added here are automatically available in all our tests. Pretty neat.

# Why Not RSpec?

I chose not to use RSpec because I wanted learn about the way testing is done in Rails by default and see how it compares with RSpec. So far, it seems like both approaches are equally capable of doing everything necessary to sufficiently test your code; they just take a different approach with regards to the way you <em>write</em> the tests. RSpec's syntax seems more verbose and reads like English, while Test Unit’s syntax is more terse. 

Currently, I’m leaning towards Test Unit because its terse syntax means less typing, and since it comes baked in with Rails, there is no need to inflate the code base with additional gems. (Rails 4 actually incorporated a library called MiniTest into Test Unit, which now offers support for RSpec-like syntax.)

But all this is irrelevant because what truly matters is that you practice test-driven development. Hopefully, I’ve shown you how easy it is to do it and convinced you that the benefits of doing so more than make up for the effort of writing them.