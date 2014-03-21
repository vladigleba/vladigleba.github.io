---
layout: post
title: "Deploying Rails Apps, Part 3: Configuring Nginx and Unicorn"
date: 2014-03-21 10:08
comments: true
categories: [Rails, Deployment, Phindee]
---

Having covered how to install the technology stack powering Phindee in my [part 2]({{ root_url }}/blog/2014/03/14/deploying-rails-apps-part-2-setting-up-the-server/), I will now shift gears and talk about how I configured Nginx and Unicorn. I already explained why I chose to install Nginx, but I haven’t yet explained why I chose Unicorn, so here we go.

<!-- more -->

# Unicorn and Passenger

When I deployed Phindee for the first time, I actually used the open source version of [Phusion Passenger](https://www.phusionpassenger.com/) due to the fact that it was (and is) easier to setup than Unicorn. My main concern, at the time, was to have a functioning app deployed as soon as possible, with as little effort as possible, and Passenger helped me do just that. 

Eventually, I reached a point where I was ready for something that I could configure myself, and Unicorn seemed like a good next step. But if you’re a beginner, Passenger will be the easiest to start with since it’s designed to integrate into Nginx directly and, therefore, requires less work to setup and maintain. You will have to pay for the Enterprise version, however, if you want advanced features like error-resistant, zero-downtime deploys, which come for free with Unicorn.

## Do One Thing, Do It Well

The reason why I like Unicorn is due to its philosophy of doing a few things well. An example of this is load balancing, which Unicorn hands off to the operating system entirely. When Unicorn starts, its master process spawns (forks) a configured number of processes called workers. These workers then handle the incoming requests to your app and only accept a request when they’re ready.

But it’s the operating system that handles the forking, as well as the distribution of requests between processes that are ready to accept, not Unicorn. What Unicorn does is the actual monitoring of workers themselves through the master process. If a worker, for example, takes too much time to complete a task, the master process will kill it and spawn a new one.

## Deploys Done Right

What this design can achieve is error-resistant, zero-downtime deploys. Error-resistant deploys ensure that if something goes wrong during a deploy, your app will remain online and serve incoming requests using the old code. This is possible because Unicorn doesn’t kill off old workers until new workers have successfully forked, which means your old workers will stay alive if something goes wrong with the new ones.

Zero-downtime deploys work in a similar manner. We can send a signal to the master process telling it to start a new master, and this new master will then begin reloading our new code. Once it’s fully loaded, the new master will fork its workers. The first worker forked will notice there is still an old master running, and it’ll send a signal telling it to start gracefully shutting down its workers. When all workers finish serving their current requests, the old master then dies, and our app is fully reloaded with new code.

Passenger supports rolling restarts like this as well, but they only come with the paid Passenger Enterprise version. One advantage the Enterprise version provides, however, is it restarts the processes one-by-one, which requires less memory. Rolling restarts with Unicorn, on the other hand, are done all at once and temporarily require twice the memory usage. It is possible, of course, to script one-by-one rolling restarts in Unicorn, but Passenger does this automatically for you.

# Puma

Another alternative to Unicorn and Passenger is Puma. Whereas Unicorn and Passenger achieve concurrency through the use of forks, Puma achieves it by running multiple threads in a single process. Of course, this means that your code must be thread-safe, but since Rails 4 is thread-safe by default, this shouldn’t be an issue. 

Because threading requires less memory than forking, Puma will be more memory efficient than a similar Unicorn setup. Puma, however, does not do rolling restarts, nor does watch for and restart failed processes, like Unicorn, which means you’ll need a service like [Monit](http://mmonit.com/monit/) that monitors and restarts them for you. As with any technology, pick whatever best meets your needs.

# Configuring Unicorn

With that out of the way, we’re now ready to start configuring Unicorn. We’ll begin by adding the following line to our app’s `Gemfile`:

``` ruby Gemfile
gem 'unicorn', '~> 4.8.0’
```

Make sure you change the version number to whatever’s the most recent one at the time of your install. The `~>` notation means that any future minor updates (e.g., from 4.0.0 to 4.0.1) will be installed, but major ones (e.g., from 4.0 to 4.1) won’t be. Major updates can sometimes introduce unexpected behavior in your app, so it’s best to limit the updates to minor releases only.

We can install Unicorn by running `bundle` in the root path of our app, and Bundler, which we installed in [part 2]({{ root_url }}/blog/2014/03/14/deploying-rails-apps-part-2-setting-up-the-server/), will take care of the install for us.
 
Having Unicorn installed, we can begin configuring it. We’ll start by creating a file called `unicorn.rb` on our local computer inside the `/config` directory of our Rails application. This is how my file for Phindee looks:

``` ruby unicorn.rb
root = “/var/www/phindee/current"
working_directory root
pid "#{root}/tmp/pids/unicorn.pid"
stderr_path "#{root}/log/unicorn.log"
stdout_path "#{root}/log/unicorn.log"

listen "/tmp/unicorn.phindee.sock"
worker_processes 2
timeout 30
```

The first variable `root` represents the path to the root directory, which is `/var/www/phindee/current` in my case. You can set this to whatever you like, but generally, web apps are often stored inside `/var/www` on Unix since the `/var` directory is designated for files that increase in size over time, and that’s the case with most web apps.

Below is what the rest of the configurations mean: 

- `working_directory` specifies exactly what is says&mdash;the app’s working directory&mdash; and it’s set to the variable `root`, which we just defined.

- `pid` specifies the path to a `.pid` file that will store the process ID of Unicorn’s master process, which can be later used to stop the process itself. These files are typically stored inside the `/tmp` directory since they exist only while Unicorn is running, so you can leave this line the way it is.

- `stderr_path` and `stdout_path` specify the path to `stderr` and `stdout`. If you’re not familiar with what they mean, when a Unix program starts up, it has three streams opened for it: one for input called “standard input” (abbreviated `stdin`), one for output called “standard output” (abbreviated `stdout`), and one for printing error messages called “standard error” (abbreviated `stderr`). Given our configuration, this means that any error messages written by our Rails app to the `stderr` stream will get written to the `.log` file specified in the `stderr_path`. It’s common to point `stdout_path` to the same location as `stderr_path` and store them both inside the `/log` directory.

- `listen` specifies the path to a socket that will listen for a client wanting to make a connection request. If you’re unfamiliar with this, a socket is basically a software object consisting of a port number that’s attached to an IP address. It allows clients and servers to communicate with one another by writing to and reading from their sockets. Since they’re running only when Unicorn is running, they’re usually stored inside the `/tmp` directory as well.

- `worker_processes` specifies the number of workers that the master process will fork for client request handling. The more workers you set, the more memory you’ll need, and since I don’t have a large amount of memory on my VPS, I decided to set mine to two. This should be enough for a low-traffic app, but once your traffic rises, the number of workers, as well as the amount of memory available to your server, will need to rise with it.

- `timeout` specifies the maximum number of seconds a worker can take to respond to a request before the master kills it and forks a new one. 30 seconds is a good value to put here since whenever a worker takes longer than this to respond, it’s usually safe to assume there is something wrong with the worker itself.

You can get a complete list of all the other possible configuration options by taking a look Unicorn’s [Configurator Module](http://unicorn.bogomips.org/Unicorn/Configurator.html).

# Managing Unicorn Processes

Having Unicorn configured, we’ll now need to setup a way for us to manage the Unicorn processes themselves.

Unicorn uses signals to communicate with its processes, and you can find a full explanation of all the available signals [here](http://unicorn.bogomips.org/SIGNALS.html). But sending these signals manually would be a pain. I recommend using a [script on GitHub](https://github.com/railscasts/335-deploying-to-a-vps/blob/master/blog-nginx/config/unicorn_init.sh) to automate this process for you. Go ahead and create your own `unicorn_init.sh` file inside your app’s `/config` directory and copy/paste the script’s code into it. All the variables you can change are defined at the of the script, but for now, the only thing you’ll need to change is the `APP_ROOT` variable, which you’ll set to the same path that the `root` variable in `unicorn.rb` is set to.

If you’re inside the root directory of your Rails app, you can then make the script executable with the following command :

``` bash
chmod +x config/unicorn_init.sh
```

I’d like to point out that the way `unicorn.rb` and `unicorn_init.sh` is currently setup, Unicorn won’t be doing rolling restarts. If you look at `unicorn_init.sh`, for example, you’ll notice that it sends a `HUP` signal when you run the script’s `restart` command. This signal doesn’t spawn a new master process, the way a rolling restart would do; it simply reloads the `unicorn.rb` file and gracefully restarts all the workers using the same master process.

You’d need to use the `USR2` signal for a rolling restart (which is actually what happens when you run the script’s `upgrade` command). But even then, there are still additional steps you’ll need to take to make everything runs smoothly, like making sure your database connections carry over, as well as ensuring any changes to the database are compatible with the older code.

I won’t be explaining how to do this here because I haven’t yet set it up myself, but if you’re curious, there is a good [blog post](http://www.justinappears.com/blog/2-no-downtime-deploys-with-unicorn/) explaining all the nuances you need to be aware of. Phindee is currently a small, low-traffic app and its code is reloaded within seconds, so I’m not worried about users waiting for their requests and don’t see a need for rolling restarts at the moment, but I’m hoping the need presents itself soon.

# Configuring Nginx

Having configured Unicorn, we can move on to configuring Nginx. We’ll start by creating a file called `nginx.conf` inside, as you might probably guess, the `/config` directory. Here’s how mine looks like:

``` nginx nginx.conf
worker_processes 1;

events {
  worker_connections 1024;
}

upstream unicorn {
  server unix:/tmp/unicorn.phindee.sock fail_timeout=0;
}

server {
  server_name www.phindee.com;
  return 301 $scheme://phindee.com$request_uri;
}

server {
  listen 80 default deferred;
  server_name phindee.com;
  root /var/www/phindee/current/public;

 location ^~ /assets/ {
    gzip_static on;
    expires max;
    add_header Cache-Control public;
  }

  try_files $uri/index.html $uri @unicorn; 
  location @unicorn {
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $http_host;
    proxy_redirect off;
    proxy_pass http://unicorn;
  }
  
  error_page 500 502 503 504 /500.html;
  keepalive_timeout 5;
}
```

You might have noticed that the first thing we do is specify the number of workers to run. Sounds familiar, doesn’t it? Well, that’s because Nginx, like Unicorn, also has a master process managing all the workers, and the workers are the ones responsible for processing requests from clients. Unlike Unicorn, Nginx also has a cache loader process that checks and/or populates the cache with metadata, as well a cache manager process that’s responsible for cache expiration. Together, they keep Nginx internals running quickly and efficiently.

## A Bit on Workers

As you can see, we used the `worker_processes` directive to tell Nginx to run one worker, which is the default. We then used the `worker_connections` directive inside the `events` block to specify that the maximum number of connections a worker can accept is 1024, which is also the default. Since we’re using defaults for both directives, it wasn’t necessary to add them to our file at all, but I chose to include them for completeness.

Given our current configuration, our server will be able to accept a total of 1024 simultaneous connections. If you want to increase this, it’s generally best to increase the `worker_connections` value before increasing the number of workers. Remember, each worker is a single-threaded process, so whenever you increase the number of workers, you’re also increasing the total amount of memory that will be used up. Having one worker process that’s capable of handling 1024 connections is more than enough for a low-traffic app, however.

## Hooking up with Unicorn and Handling Redirects

Since Nginx is not capable of handling requests for pages that are dynamically generated by Rails, we need to tell it to somehow pass such requests off to Unicorn. We’ll take the first step to accomplishing this by defining an `upstream` block called `unicorn`, inside which we point the server to the same Unix socket that we used in our `unicorn.rb` file. This is just the first step, however, and more work needs to be done to get this working, as you’ll see later. By the way, in case you’re wondering, setting the `fail_timeout` to 0 is necessary for Nginx to correctly handle Unicorn timing out due to its worker being killed when it takes longer than 30 seconds to respond, as specified in `unicorn.rb`.

The `server` block right below the `upstream` block is there to redirect a request for "www.phindee.com" to "phindee.com". The `server_name` directive specifies the URL we’re redirecting from, while the `return` directive specifies where to redirect to. (Notice we’re returning a 301 status code to specify a permanent redirection.) The `$scheme` variable stores the HTTP scheme (i.e. http, https), while `$request_uri` stores the unmodified URI of a client request, which includes the arguments, but not the host name (e.g. "/foo/bar.php?arg=baz").

## Where the Meat Is

The next `server` block contains the main configuration. The `listen` directive inside it tells Nginx to listen on port 80, and the `server_name` directive right below specifies the domain name that Nginx will try to match, which is "phindee.com" in my case. 

Specifying `default` in the `listen` directive, by the way, tells Nginx to use this server block by default if it can’t find a matching domain name, which means I could technically leave out the `server_name` directive, and everything would still work because of `default`, but I like to leave it in for readability. And finally, I added the `deferred` option since I’m running this on Linux, which tells Nginx to use the `TCP_DEFER_ACCEPT` option to [speed up performance](http://www.techrepublic.com/article/take-advantage-of-tcp-ip-options-to-optimize-data-transmission/) by reducing the amount of preliminary work that happens between a client and the server.

Moving along, the `root` directive specifies the directory in which Nginx will look to handle requests for static files. Note that this is <em>not</em> our app’s root directory, but our app’s `/public` directory, and this is where our static files are/will reside. Currently, it only contains various error pages, a favicon, and a `robots.txt` file for search engines. When we later deploy with Capistrano, it’ll contain all our assets as well, including stylesheets, scripts, images, and fonts. 

## Handling Asset Requests

Just like the `server_name` directive handles requests for domain names, the `location` directive handles requests for specific files and folders. The caret and tilde (`^~`) tells Nginx to do a regular expression match on `/assets/` and to stop searching as soon as it finds a match (see the [Linode Guide](https://library.linode.com/web-servers/nginx/configuration/basic#sph_location-file-and-folder-configuration) to learn more).

By setting the `gzip_static` directive to `on`, we’re then telling Nginx to look for an already pre-compressed `.gz` file <em>before</em> proceeding to compress it. This prevents Nginx from compressing the same file each time it is requested. 

The `expires` directive then makes the response cacheable and marks it with an expiry date set to `max`, which is equivalent to December 31st, 2037. This tells browsers and any caching servers to not request these assets again until the specified date. Of course, if we make changes to our stylesheets, for example, Rails will change the filename and browsers will still receive the latest version, which will then also be cached. 

Using the `expires` directive, however, is an outdated method of specifying caching, and it’s recommended to use `Cache-Control` header instead. The next line in the code does just that through the `add_header` directive. (The reason we include  `expires` is to make things backward-compatible.) It’s possible, by the way, to set `Cache-Control` to either `public` or `private`, and I’m setting it to `public` because we’re caching assets that are meant to be used by everybody, whereas `private` would mean they’re unique to individual users (see [Stack Overflow](http://stackoverflow.com/questions/3492319/private-vs-public-in-cache-control) to learn more).

## Trying to Find a Match

The next line is the `try_files` directive, which is there for requests that didn’t match with any `location` blocks. In our case, it tries to match non-asset requests. The `$uri` variable contains the current request URI, minus the arguments, protocol, and host name, so if we typed in "phindee.com/assets" into the address bar, the `$uri` would be "/assets", and given our `try_files` directive, Nginx would try to first find an `/assets/index.html` file. If it found no such file, it would then try to find an `/assets` directory, and if that wouldn’t exist, it would then pass the request off to Unicorn through a named location, which is defined next through the `location` directive and called `@unicorn`.

Inside the named location, the `proxy_pass` directive does all the heavy lifting. We set it to `http://unicorn` so that it points to the `upstream` block called `unicorn`, which we already defined, and the request is then handled by the Unicorn socket defined there. The two `proxy_set_header` directives then append additional headers needed for Unicorn, while `proxy_redirect` set to `off` prevents Nginx from doing any redirect handling. (There is a sample `nginx.conf` file [on GitHub](https://github.com/defunkt/unicorn/blob/master/examples/nginx.conf) with comments explaining why this is necessary.)

## Last Few Lines

Alright, we’re down to the last two lines. `error_page` makes sure that our app’s `500.html` page is show for any 500-related errors, while `keepalive_timeout` tells Nginx to retain keep-alive connections (also known as persistent connections) for up to 10 seconds and close them if they exceed that time. 

Persistent connections, by the way, are used to send multiple HTTP requests in a single connection, as opposed to opening a new connection for each request; in HTTP 1.1, all connections are persistent by default, which means stylesheets, scripts, images, and fonts, for example, would all be downloaded using a single connection.

These are, of course, not all the options you can specify. If you’d like to learn about the additional ones, feel free to read through the comments in the sample `nginx.conf` [file](https://github.com/defunkt/unicorn/blob/master/examples/nginx.conf) I mentioned earlier.

# That Was Long

I didn’t expect the post to be quite this long, and if you made all the way to the end, pat yourself on the back. But I personally love posts that explain the reasoning behind their decisions, and I tried to do the same here. I think it prepares readers to be able to make their own informed decisions in their own projects.

In the next and final post of this series, I will introduce Capistrano and show you how I use it to deploy Phindee to my VPS. If you want to be notified when it’s out, feel free to [subscribe](http://www.feedblitz.com/f/?Sub=927939&cids=1), and the post will be delivered to your inbox as soon as it’s released!
