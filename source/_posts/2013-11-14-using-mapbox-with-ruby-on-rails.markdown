---
layout: post
title: "Using MapBox with Ruby on Rails"
date: 2013-11-14 10:39
comments: true
categories: [Maps, Phindee]
description: Learn how to use the Mapbox.js library to add custom maps to your Ruby on Rails app. 
---

Last week [I wrote about]({{ root_url }}/blog/2013/11/08/phindee-a-new-way-to-discover-happy-hours-in-downtown-portland/) [Phindee](http://phindee.com/), a Ruby on Rails app I made to make it easy to discover happy hours in downtown Portland. I quickly mentioned that Phindee’s mapping functionality is provided by the [MapBox JavaScript API](https://www.mapbox.com/mapbox.js/), but did not go into any more detail for brevity reasons. I still think it’s an important topic to talk about because I remember having a hard time finding tutorials about integrating MapBox with Ruby on Rails, specifically. 

<!-- more -->

I hope this post fills a bit of that void.

# Why MapBox?

It’s actually quite simple, really. You see, Google is an immense company swimming in cash and dominating virtually every product it has its hands in. Who has the world’s most popular video sharing site? Google. Search engine? Google. How about email service? Google. And mapping service? Google. Whose mobile operating system has the largest market share worldwide? Google’s. Heck, it’s not even a close race in most of these categories. 

While this is great for the company, it's not so healthy for the rest of us. Whenever a company lacks competition, the pace of innovation slows, and arrogance towards customers tends to rise. Anytime a majority of our data is concentrated in the hands of a single company, feelings of unease should arise. That’s why whenever a small, promising startup takes on the giant, I will cheer for [the underdog](http://venturebeat.com/2013/10/16/mapbox-heads-into-battle-against-google-maps-with-a-10m-war-chest-from-foundry-group/). And [I’m not the only one](http://www.pcmag.com/article2/0,2817,2401037,00.asp).

Besides, MapBox is actually open source, and given a choice, I’ll go with open source over proprietary any day.

# Converting Addresses into Coordinates

All right, enough of that. Let's start coding.

First thing we'll do is convert our addresses into coordinates, which MapBox needs in order to place our markers (pin-drops) on the map. We can do this manually by using the [MapBox Geocoding API](https://www.mapbox.com/developers/api/geocoding/), or we could automate it with the [Geocoder](http://www.rubygeocoder.com/) gem. Because there is a [Railscasts episode](http://railscasts.com/episodes/273-geocoder) covering the gem, I won’t go into any more detail here.

# Building a JSON object

Once we have the coordinates, we’re ready to build a JSON object array that will tell MapBox how to display our markers. Our JSON objects will be in the [GeoJSON format](https://en.wikipedia.org/wiki/GeoJSON), which is just a format to describe geographic data in JSON. MapBox uses the GeoJSON format to capture the necessary data needed to generate all the markers on the map. Building a JSON object in Rails is easy. The code below shows how I did it for Phindee; it comes from my `HappyHourController`.

``` ruby happy_hours_controller.rb
@happy_hours = HappyHour.all
@geojson = Array.new

@happy_hours.each do |happy_hour|
  @geojson << {
    type: 'Feature',
    geometry: { 
      type: 'Point', 
      coordinates: [happy_hour.longitude, happy_hour.latitude] 
    },
    properties: { 
      name: happy_hour.name,
      address: happy_hour.street,
      :'marker-color' => '#00607d', 
      :'marker-symbol' => 'circle', 
      :'marker-size' => 'medium' 
    }
  }
end
```

The above code simply loops through each happy hour, creates an object, then appends and returns the newly created object to the `@geojson` array with the help of the `<<` method. Note that each object in our JSON array must contain a `type` key, a `geometry` key, and a `property` key. In our example above, the `geometry` key says that we want our marker displayed as a point at that specific set of coordinates, while the `property` key says we want our marker to be a medium blue circle that displays the happy hour name and street address when clicked.

I placed the above code inside one of the methods in my happy_hours_controller.rb file, as that’s the controller that deals with happy hours. You’ll place your code inside whatever controller is appropriate for your specific situation.

## Telling Rails How to Respond

Because we want Rails to be able to return a JSON object, we’ll need to explicitly tell it do so via a `respond_to` block, which we will place right after the code we wrote above.

``` ruby happy_hours_controller.rb
respond_to do |format|
  format.html 
  format.json { render json: @geojson }  # respond with the created JSON object
end
```

Depending on the type of request, only one of the two lines above will be executed. For example, when we will later make an AJAX request in the JSON format, Rails will know to respond with the JSON object we just created above; otherwise, it will respond with a regular HTML file.

# Working with the MapBox API

Now that we have the building blocks in place, we’re ready to start working with the MapBox API itself. My code examples below will all be in CoffeeScript because that’s what I used for Phindee, but if you’re not familiar with CoffeeScript, you can copy the code examples into [js2coffee.org](http://js2coffee.org/) to get the JavaScript equivalent.

## Adding the Library Code

All right, first thing we’ll do is include the MapBox JavaScript API, along with the accompanying CSS code; this will go inside our main application layout file.

``` html application.html.erb
<script src="http://api.tiles.mapbox.com/mapbox.js/v1.0.2/mapbox.js"></script>
<link href="http://api.tiles.mapbox.com/mapbox.js/v1.0.2/mapbox.css" rel="stylesheet" />
```

When I wrote this code, the latest version of the MapBox JavaScript API was 1.0.2, and my links above reflect that. See their [documentation](https://www.mapbox.com/mapbox.js/overview/) for the current latest version and update your links accordingly.

## Initializing the Map

Next, we’ll create a free MapBox account and make our own custom-colored map. Once we have the map ready, we’ll open the JavaScript file that corresponds to the controller which contains the two earlier code blocks (mine is called `happy_hours.js.coffee`), and we’ll add a line instantiating the map with the map ID of the custom-colored map we just created.

``` coffeescript happy_hours.js.coffee
# initialize the map on the 'map' div 
# with the given map ID, center, and zoom
map = L.mapbox.map('map', 'your-map-id').setView([45.52086, -122.679523], 14)
```

The coordinates we’re passing on to the `setView()` method tell the API where to center the map, while the 14 represents the zoom level for the map. In reality, `setView()` actually comes from the [Leaflet JavaScript library](http://leafletjs.com/reference.html#map-setview); MapBox simply extends and simplifies it.

## Making the AJAX Call

Okay, now we’re ready to use the JSON objects we created earlier. We’ll make an AJAX call in the JSON format, and Rails will return our JSON object.

``` coffeescript happy_hours.js.coffee
# get JSON object
# on success, parse it and 
# hand it over to MapBox for mapping 
$.ajax
  dataType: 'text'
  url: 'happy_hours/happening_now.json'
  success: (data) ->
    geojson = $.parseJSON(data)
    map.featureLayer.setGeoJSON(geojson)
```

The code above simply sends out an AJAX call to the URL that corresponds to the controller method into which we added the JSON object code from before. The `.json` extension alerts Rails to return a JSON response, instead of an HTML one. On a successful return, we then parse the JSON object and pass it on to the `setGeoJSON()` method for mapping. Kid stuff.

## Creating Custom Popups

Now we’ll create our custom popups.
  
``` coffeescript happy_hours.js.coffee
# add custom popups to each marker
map.featureLayer.on 'layeradd', (e) ->
  marker = e.layer
  properties = marker.feature.properties

  # create custom popup
  popupContent =  '<div class="popup">' +
                    '<h3>' + properties.name + '</h3>' +
                    '<p>' + properties.address + '</p>' +
                  '</div>'

  # http://leafletjs.com/reference.html#popup
  marker.bindPopup popupContent,
    closeButton: false
    minWidth: 320
```

To summarize the code above, we’re simply looping through each marker, creating a custom popup for it, and then binding it using the `bindPop()` method, which once again comes from the Leaflet library.

## Opening a Popup Programmatically

If you look at [Phindee](http://phindee.com/), you’ll notice that when you open the sidebar and click on a happy hour, the popup on the corresponding marker on the map automatically opens up. Being able to open up a popup programmatically is useful, and below is how I did it.

``` coffeescript happy_hours.js.coffee
# handles a sidebar happy hour click
$('article li').click (e) ->  
  current = $(this)
  currentlyClickedName = current.find('h2').text()
  
  # opens/closes popup for currently clicked happy hour
  map.featureLayer.eachLayer (marker) ->
    if marker.feature.properties.name is currentlyClickedName
      id = layer._leaflet_id
      map._layers[id].openPopup()
```

We’re simply adding a `click` event on the sidebar happy hours, extracting the happy hour name, and looping through each marker to find the one with the matching name. Once we find a match, we extract the marker’s ID, and use that ID to open up the popup programmatically by calling Leaflet’s `openPopup()` method. 

And that’s all there is to it! Our MapBox integration with Ruby on Rails is now complete, although we only scratched the surface of what's possible. Feel free to take a look at the [MapBox](https://www.mapbox.com/mapbox.js) and [Leaflet](http://leafletjs.com/reference.html) documentation to learn more.