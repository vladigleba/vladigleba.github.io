---
layout: post
title: "Deploying Rails Apps, Part 3: Configuring Unicorn"
date: 2014-03-21 10:08
comments: true
categories: [Rails, Deployment, Phindee]
---

Having covered how to install the technology stack powering Phindee in [part 2]({{ root_url }}/blog/2014/03/14/deploying-rails-apps-part-2-setting-up-the-server/), I will now shift gears and talk about how I configured Unicorn. I already explained why I chose to install Nginx, but I haven’t yet explained why I chose Unicorn, so here we go.

<!-- more -->

[Unicorn](http://unicorn.bogomips.org/) is an HTTP server for Ruby. It's designed to be used in a production environment, unlike WEBrick, which is designed for running your app on your local computer. Because it's fast, efficient, and offers tons of cool features, like load balancing and rolling restarts, Unicorn has become a popular production server for Rails apps.

# Comparing Unicorn with Passenger

When I deployed Phindee for the first time, however, I actually used the open source version of [Phusion Passenger](https://www.phusionpassenger.com/), due to the fact that it was (and is) easier to setup than Unicorn. My main concern, at the time, was to have a functioning app deployed as soon as possible, with as little effort as possible, and Passenger helped me do just that. 

Eventually, I reached a point where I was ready for something that I could configure myself, and Unicorn seemed like a good next step. But if you’re a beginner, Passenger will be the easiest to start with since it’s designed to integrate into Nginx directly and, therefore, requires less work to setup and maintain. You will have to pay for the Enterprise version, however, if you want advanced features like error-resistant, zero-downtime deploys, which come for free with Unicorn.

## Do One Thing, Do It Well

The reason why I like Unicorn is due to its philosophy of doing a few things well. An example of this is load balancing, which Unicorn hands off to the operating system entirely. When Unicorn starts, its master process spawns (forks) a configured number of processes called workers. These workers then handle the incoming requests to your app and only accept a request when they’re ready.

But it’s the operating system that handles the forking, as well as the distribution of requests between processes that are ready to accept, not Unicorn. What Unicorn does is the actual monitoring of workers themselves through the master process. If a worker, for example, takes too much time to complete a task, the master process will kill it and spawn a new one.

## Deploys Done Right

What this design can achieve is error-resistant, zero-downtime deploys. Error-resistant deploys ensure that if something goes wrong during a deploy, your app will remain online and serve incoming requests using the old code. This is possible because Unicorn doesn’t kill off old workers until new workers have successfully forked, which means your old workers will stay alive if something goes wrong with the new ones.

Zero-downtime deploys work in a similar manner. We can send a signal to the master process telling it to start a new master, and this new master will then begin reloading our new code. Once it’s fully loaded, the new master will fork its workers. The first worker forked will notice there is still an old master running, and it’ll send a signal telling it to start gracefully shutting down its workers. When all workers finish serving their current requests, the old master then dies, and our app is fully reloaded with new code.

Passenger supports rolling restarts like this as well, but they only come with the paid Passenger Enterprise version. One advantage the Enterprise version provides, however, is it restarts the processes one-by-one, which requires less memory. Rolling restarts with Unicorn, on the other hand, are done all at once and temporarily require twice the memory usage. It is possible, of course, to script one-by-one rolling restarts in Unicorn, but Passenger does this automatically for you.

# How about Puma?

Another alternative to Unicorn and Passenger is Puma. Whereas Unicorn and Passenger achieve concurrency through the use of forks, Puma achieves it by running multiple threads in a single process. Of course, this means that your code must be thread-safe, but since Rails 4 is thread-safe by default, this shouldn’t be an issue. 

Because threading requires less memory than forking, Puma will be more memory efficient than a similar Unicorn setup. Puma, however, does not do rolling restarts, nor does watch for and restart failed processes, like Unicorn, which means you’ll need a service like [Monit](http://mmonit.com/monit/) that monitors and restarts them for you. As with any technology, pick whatever best meets your needs.

# Installing and Configuring Unicorn

With that out of the way, we’re now ready to start working with Unicorn. We’ll begin by adding the following line to our app’s `Gemfile` on our local computer:

``` ruby Gemfile
gem 'unicorn', '~> 4.8.0’
```

Make sure you change the version number to whatever’s the most recent one at the time of your install. The `~>` notation means that any future minor updates (e.g., from 4.0.0 to 4.0.1) will be installed, but major ones (e.g., from 4.0 to 4.1) won’t be. Major updates can sometimes introduce unexpected behavior in your app, so it’s best to limit the updates to minor releases only.

We'll then install Unicorn by running `bundle` in the root path of our app, and Bundler, which we installed in [part 2]({{ root_url }}/blog/2014/03/14/deploying-rails-apps-part-2-setting-up-the-server/), will take care of the install for us.
 
Having Unicorn installed, we can begin configuring it. We’ll start by creating a file called `unicorn.rb` on our local computer inside the `/config` directory of our Rails application. This is how my file for Phindee looks:

``` ruby unicorn.rb
root = "/var/www/phindee/current"
working_directory root
pid "#{root}/tmp/pids/unicorn.pid"
stderr_path "#{root}/log/unicorn.log"
stdout_path "#{root}/log/unicorn.log"

listen "/tmp/unicorn.phindee.sock"
worker_processes 2
timeout 30
```

The first variable `root` represents the path to the root directory of our app, which I've set to `/var/www/phindee/current`. Generally, web apps are stored inside `/var/www` on Unix since the `/var` directory is designated for files that increase in size over time, which is the case with most web apps, and a `/www` directory is typically created inside `/var` to store files meant for the web. I then have a `/phindee` directory specified inside `/www` to store all things related to Phindee, as well as a `current` directory, which Capistrano will later create and use to store the latest deployment code. You don't have to actually create these directories now, as Capistrano we'll create them itself when it runs.

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

If you’re inside the root directory of your Rails app, you can then make the script executable with the following command:

``` bash
chmod +x config/unicorn_init.sh
```

I’d like to point out that the way `unicorn.rb` and `unicorn_init.sh` is currently setup, Unicorn won’t be doing rolling restarts. If you look at `unicorn_init.sh`, for example, you’ll notice that it sends a `HUP` signal when you run the script’s `restart` command. This signal doesn’t spawn a new master process, the way a rolling restart would do; it simply reloads the `unicorn.rb` file and gracefully restarts all the workers using the same master process.

You’d need to use the `USR2` signal for a rolling restart (which is actually what happens when you run the script’s `upgrade` command). But even then, there are still additional steps you’ll need to take to make everything runs smoothly, like making sure your database connections carry over, as well as ensuring any changes to the database are compatible with the older code.

I won’t be explaining how to do this here because I haven’t yet set it up myself, but if you’re curious, there is a good [blog post](http://www.justinappears.com/blog/2-no-downtime-deploys-with-unicorn/) explaining all the nuances you need to be aware of. Phindee is currently a small, low-traffic app and its code is reloaded within seconds, so I’m not worried about users waiting for their requests and don’t see a need for rolling restarts at the moment, but I’m hoping the need presents itself soon.

Having configured Unicorn, we'll move on to configuring Nginx in [part 4]({{ root_url }}/blog/2014/03/27/deploying-rails-apps-part-4-configuring-nginx/). If you want to be notified when it’s out, feel free to [subscribe](http://www.feedblitz.com/f/?Sub=927939&cids=1), and the post will be delivered to your inbox as soon as it’s released!