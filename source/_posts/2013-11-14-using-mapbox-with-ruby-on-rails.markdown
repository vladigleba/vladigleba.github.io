---
layout: post
title: "Using MapBox with Ruby on Rails"
date: 2013-11-14 10:39
comments: true
categories: [Rails, CoffeeScript, MapBox, phindee]
---

Last week [I wrote]({{ root_url }}/blog/2013/11/08/phindee-a-new-way-to-discover-happy-hours-in-downtown-portland/) about [phindee](http://phindee.com/), a Ruby on Rails app I made to make it easy to discover happy hours in downtown Portland. I quickly mentioned that phindee’s mapping functionality is provided by the [MapBox JavaScript API](https://www.mapbox.com/mapbox.js/), but did not go into any more detail for brevity reasons. I still think it’s an important topic to talk about because I remember having a hard time finding tutorials about integrating MapBox with Ruby on Rails, specifically. 

I hope this post fills a bit of that void. <!-- more -->

# Why MapBox?

It’s actually quite simple, really. You see, Google is an immense company swimming in cash and dominating virtually every product in which it has its hands. Who has the world’s most popular video sharing site? Google. Email service? Google. Search engine? Google. Mapping service? Google. Whose mobile operating system has the largest market share? Google’s. Heck, it’s not even a close race in most of these categories. This is not healthy, no matter how you measure it.

MapBox is also open source, and Google Maps is obviously not. When I have a choice, I’ll go with open source over proprietary any day.

Whenever a company lacks competition, the pace of innovation slows. Every time a majority of our data is concentrated in the hands of a single company, we should feel a bit uneasy. That’s why every time a small, promising startup tries to take on the giant, I will always [cheer](http://venturebeat.com/2013/10/16/mapbox-heads-into-battle-against-google-maps-with-a-10m-war-chest-from-foundry-group/) for the underdog. Always. And I’m glad [I’m not the only one](http://www.pcmag.com/article2/0,2817,2401037,00.asp).

# Converting Addresses into Coordinates

If you already have the coordinates, feel free to proceed to the next section; otherwise, we first need to convert our addresses into coordinates, which MapBox needs in order to place our markers (pin-drops) on the map. 

We could use the [Google Geocoding API](https://developers.google.com/maps/documentation/geocoding/) to do this manually, but I recommend using the [Geocoder](http://www.rubygeocoder.com/) gem to automate the process for us. The gem uses the Google Maps API by default, but it supports other services as well. 

Because there is a [Railscasts episode](http://railscasts.com/episodes/273-geocoder) covering the gem, I won’t go into any more detail here.

# Building a JSON object

Once we have the coordinates, we’re ready to build a JSON object array that will tell MapBox how to display our markers. Our JSON objects will be in the GeoJSON format, which is just a format to describe geographic data in JSON. MapBox uses the [GeoJSON format](https://en.wikipedia.org/wiki/GeoJSON) to capture the necessary data needed to generate all the markers on the map. Building a JSON object in Rails is easy. Below is how I do it for phindee.

``` ruby
@happy_hours = HappyHour.all
@geojson = Array.new

@happy_hours.each do |happy_hour|
  @geojson << {
   type: 'Feature',
   geometry: { 
      type: 'Point', 
      coordinates: [ happy_hour.longitude, happy_hour.latitude ] },
    properties: { 
      name: happy_hour.name
      address: happy_hour.street,
     :'marker-color' => '#00607d', 
      :'marker-symbol' => 'circle', 
      :'marker-size' => 'medium' 
    }
  }
end
```

The above code simply loops through each happy hour, creates an object, then appends and returns the newly created object to the `@geojson` array with the help of the `<<` method. Note that each object in our JSON array must contain a `type` key, a `geometry` key, and a `property` key. In our example above, the `geometry` key says that we want our marker to displayed as a point at that specific set of coordinates, while the `property` key says we want our marker to be a medium blue circle that displays the happy hour name and street address when clicked.

I placed the above code inside one of the methods in my happy_hours_controller.rb file, as that’s the controller that deals with happy hours. You’ll place your code inside whatever controller is appropriate for your specific situation.

## Telling Rails How to Respond

Because we want Rails to be able to return a JSON object, we’ll need to explicitly tell it do so via a `respond_to` block, which we will place right after the code we wrote above.

``` ruby
respond_to do |format|
  format.html 
  format.json { render json: @geojson }  # respond with the created JSON object
end
```

Depending on the type of request, only one of the two lines above will be executed. For example, when we will later make an AJAX request in the JSON format, Rails will know to respond with the JSON object we just created above; otherwise, it will respond with a regular HTML file.

# Working with the MapBox API

Now that we have the building blocks in place, we’re ready to start working with the MapBox API itself. My code examples below will all be in CoffeeScript because that’s what I used for phindee, but if you’re not familiar with CoffeeScript, you can copy the code examples below into [js2coffee.org](http://js2coffee.org/) to get the JavaScript equivalent.

## Adding the Library Code

Alright, first thing we’ll do is include the MapBox JavaScript API, along with the accompanying CSS code. When I wrote this code, the latest version of the MapBox JavaScript API was 1.0.2, so my links below reflect that. See their [documentation](https://www.mapbox.com/mapbox.js/overview/) for the current latest version and update your links accordingly.

``` html
<script src="http://api.tiles.mapbox.com/mapbox.js/v1.0.2/mapbox.js"></script>
<link href="http://api.tiles.mapbox.com/mapbox.js/v1.0.2/mapbox.css" rel="stylesheet" />
```

## Initializing the Map

Next, we’ll create a free MapBox account and make our own custom-colored map. Afterwards, we’ll open the JavaScript file that corresponds to the controller which contains the two earlier code blocks (mine is called happy_hours.js.coffee), and we’ll add a line instantiating the map with the map ID of the custom-colored map we just created.

``` coffeescript
# initialize the map on the 'map' div with the given map ID, center, and zoom
map = L.mapbox.map('map', ‘your-map-id’).setView([45.52086, -122.679523], 14)
```

The coordinates we’re passing on to the `setView()` method tell the API where to center the map, while the 14 represents the zoom level for the map. In reality, `setView()` actually comes from the [Leaflet JavaScript library](http://leafletjs.com/reference.html#map-setview); MapBox simply extends and simplifies it.

## Making the AJAX Call

Okay, now we’re ready to use the JSON objects we created earlier. We’ll make an AJAX call in the JSON format and Rails will return our JSON object.

``` coffeescript
# get JSON object
# on success, parse it and 
# hand it over to MapBox for mapping 
markerLayer = $.ajax
  dataType: "text"
  url: "happy_hours/happening_now.json"
  success: (data) ->
    geojson = $.parseJSON(data)  
    map.markerLayer.setGeoJSON(geojson)
```

The code above simply sends out an AJAX call to the URL that corresponds to the controller method into which we added the JSON object code from before. The `.json` extension alerts Rails to return a JSON response, instead of an HTML one. On a successful return, we then parse the JSON object and pass it on to the `setGeoJSON()` method for mapping.

Kid stuff.

## Creating Custom Popups

Now we’ll create our custom popups.
  
``` coffeescript
# add custom popups to each marker 
map.markerLayer.on "layeradd", (e) ->
  marker = e.layer
  feature = marker.feature

  # create custom popup
  popupContent = '<div class="popup">' +
                               '<h3>' + feature.properties.name + '</h3>' + 
                               '<p>' + feature.properties.address + '</p>' +
                             '</div>'

  # http://leafletjs.com/reference.html#popup
  marker.bindPopup popupContent,
    closeButton: false
    minWidth: 320
```

To summarize the code above, we’re simply looping through each marker, creating a custom popup for it, and then binding it using the `bindPop()’ method, which once again comes from the Leaflet library.

## Opening a Popup Programmatically

If you looked at the [phindee app](http://phindee.com/), you’ll notice that when you open the sidebar and click on a happy hour, the popup on the corresponding marker on the map automatically opens up. Being able to open up a popup programmatically is useful, and below is how I did it.

``` coffeescript
# handles a sidebar happy hour click
$('article li').click (e) ->  
  current = $(this)
  currentlyClickedName = current.find('h2').text()
       
  # opens/closes popup for currently clicked happy hour
  map.markerLayer.eachLayer (layer) ->
    if layer.feature.properties.name is currentlyClickedName
      id = layer._leaflet_id
      map._layers[id].openPopup()
```

We’re simply adding a `click` event on the sidebar happy hours, extracting the happy hour name, and looping through each marker to find the one with the matching name. Once we find a match, we extract the marker’s ID, and use the ID to open up the popup programmatically by calling Leaflet’s `openPopup()` method. 

And that’s all there is to it! Our MapBox integration with Ruby on Rails is now complete. I hope you enjoyed working with MapBox as much as I did, and hopefully, you learned a few things as well.

Stay hungry, stay foolish.