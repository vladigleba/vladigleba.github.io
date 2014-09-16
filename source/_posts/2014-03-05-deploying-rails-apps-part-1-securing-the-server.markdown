---
layout: post
title: "Deploying Rails Apps, Part 1: Securing the Server"
date: 2014-03-05 11:18
comments: true
categories: [Deployment, Security, Phindee, Deployment Series]
description: Learn how to set up groups and privileges, configure SSH access, and enable SSH authentication.
---

Setting up a Rails server from scratch can be a daunting task. I remember my first attempt; it was a multi-day process full of frustration, things not working, me not understanding why, and a whole lot of googling. In an effort to make this experience less painful for those new to Rails, I’d like to share the process I went through to deploy [Phindee](http://phindee.com/) to a VPS (Virtual Private Server).

<!-- more -->

# Choosing a VPS

Phindee is currently running on DigitalOcean servers, but there are other options available as well, like Linode, which was my previous VPS provider. If you’re new to deployment, I recommend [DigitalOcean](http://digitalocean.com/) because it’ll be ideally suited to your needs, due their more flexible billing policy and cheaper plans, but any VPS provider will do.

Once you decide on a VPS, you’ll then signup for a plan. If you’re just starting out, the cheapest plan available will be enough; otherwise, choose a plan that fits your needs. Once you have an account, you’ll be able to create your server, and typically, you’ll have a list of operating systems to choose from. DigitalOcean offers a wide variety of Linux distributions; I chose the latest 32-bit version of Ubuntu for Phindee, and I recommend you do the same if you're new to deployment.

The reason why I chose the 32-bit version was because it uses less memory than the 64-bit one. This is something you should consider if you chose one of the cheaper plans with a lower amount of memory, but if memory is not an issue, go with the 64-bit since you’ll have better performance ([see this page](http://howtoubuntu.org/how-to-decide-if-you-should-use-32bit-or-64bit-ubuntu) to learn more).

# Logging In

Once you create your instance, you’ll be given your server’s IP address and password. If you’re on Linux or a Mac, open up Terminal and login. (If you're on Windows, you'll need to download Putty.) To login using Terminal, use the following command, replacing the Xs with your own IP address:

``` bash
ssh root@xxx.xxx.xxx.xxx
```

This command uses SSH to connect to your server as the user `root`. If you’re unfamiliar with SSH, it stands for Secure Shell, and it’s basically a network protocol that allows two computers to securely communicate with one another. There are many other protocols out there, such as HTTP, which allows browsers to communicate with web servers.

The first time you attempt to login, you’ll be asked if you’re sure you want to continue connecting; type "yes". Then enter the password for the `root` user, and you’ll be logged in.

# Groups and Privileges

Now that you’re in, the first thing we’ll do is change the password for `root` using the following command:

``` bash
passwd
```

This will prompt you to enter a new password twice. Next, we’ll create a new group called `deployers`, which will allow us to easily manage the users with deployment privileges:

``` bash
groupadd deployers
```

Now we’ll create a new user called `bob`, and assign him to the `deployers` group we just created above:

``` bash
adduser bob —ingroup deployers
```

This command will prompt you to enter a password for this user, in addition to some other information afterwards, but after you enter the password twice, feel free to just press “Enter” for the other fields, as they’re not strictly necessary. By the way, don’t use the same password for both `root` and the user you just created above or [bad things will happen](http://www.cartoonstock.com/lowres/computers-computer-self_destruct-explode-username-password-ksm0529l.jpg).

Next thing we’ll do is open the `sudoers` file containing a list of users and groups who have root privileges:

``` bash
nano /etc/sudoers
```

and we’ll add the following line into it (we use "%" to indicate that this is a group name):

``` text sudoers
%deployers      ALL=(ALL) ALL
```

You can then exit the nano text editor by typing "Control-X" and typing "Y" when asked if you want to save. In case you’re wondering, the line we just added above will give the users in the `deployers` group the ability to run commands as `root`. If this is new to you, let me explain.

Running commands while logged in as `root` is considered bad practice because, as the superuser, `root` can run any and all commands, and since there is no undo functionality in Unix, one accidental bad command and your system can be seriously disrupted. That’s why we created a separate user called `bob`, which will have deployment privileges and nothing else.

But why did we create a `deployers` group and added `bob` into it? Well, first of all, we could’ve avoided creating a group altogether and just added `bob` to the `sudoers` file and given *him* `root` privileges instead. But let’s say I’m working on a project with a friend and she wants to be able to deploy as well. I would have to then add her to the `sudoers` file too (to give her `root` privileges), and the file would keep growing every time a new user with deployment privileges needed to be added. This would be a nightmare to maintain.

A better way to go about this is to create a group called `deployers`, give the group `root` privileges, and then add users to this group. This way, whenever I’d need to add new users with deployment privileges, I would just need to add them to the `deployers` group. This keeps the `sudoers` file clean and organized, while allowing me to easily manage the members of the group as well. I could, for example, easily revoke some rights for all members of the `deployers` group at the same time, instead of doing it one user at a time, or I could simply remove a user from the `deployers` group if I discover, for example, that he still creates "1234" passwords for his accounts.

Okay, but why is it necessary for users and groups to have `root` privileges? Well, these privileges allow a user, say `bob`, to run commands he otherwise would not be able to run due to not having the necessary permissions, which arises from the fact that the user is not `root` and therefore has limited privileges. But given `root` privileges, or being part of a group with `root` privileges, enables `bob` to run these commands simply by preceding the command with `sudo`. He’ll then be prompted to enter his password, and the command will run.

That’s the reasoning behind giving the `deployers` group `root` privileges and adding `bob` into it. Later on, `bob` will need these privileges during the deployment process.

# Configuring SSH Access

Now we’re ready for the next step in securing our server, and we’ll start by opening the `ssh_config` file:

``` bash
nano /etc/ssh/sshd_config
```

This file contains a number of rules that define who can login to the server and in what way. The first thing we’ll do is change the port number with which users will login; the default port that servers listen on is 22, but it’s wise to change it to another value so that any potential hackers have some extra work to do in figuring out the correct one; you can choose any port number from 1025 to 65536. Once you have your number, look for a line that looks like the following:

``` text sshd_config
Port 22
```

and change its port number to the one you picked. Make sure you make a note of the new port number because you’ll need it for future login.

Next, look for another line in the file that looks like this:

``` text sshd_config
PermitRootLogin yes
```

and change the “yes” to a “no”; this prevents `root` user login, which means that any potential hackers will need to know the name of one of the users on the server to actually login.

We can even go a step further and define exactly which existing users are able to login. Since I only want `bob` to have login access, I’ll add the following line to the end of the file:

``` text sshd_config
AllowUsers bob
```

You could even specify a space-separated list of users here, if you have more than one user in need of login access.

All right, there is one final line that we’ll add to the end of our file:

``` text sshd_config
UseDNS no
```

This line disables hostname lookup, which can lead to a delay of up to 30 seconds when logging in with `ssh`. Disabling it will save you time and do no harm.

To put these changes into effect, we’ll restart SSH, like so:

``` bash
sudo service ssh restart
```

Now we’re ready to test the configurations we just made to make sure they work. I’ll open a new shell in Terminal, without closing my current one, and try to login as the user `bob` on the port I specified in `sshd_config`:

``` bash
ssh -p 23523 bob@xxx.xxx.xxx.xxx
```

Make sure you change the above command to match the user and port number you specified in your own `sshd_config` file, or it obviously won’t work. The above command will then prompt you to enter that user’s password. If you login successfully, congratulations! Your configuration is correct! You can close your previous shell and just continue using the current one; otherwise, you’ll need to go back and double check your `sshd_config` file configurations.

# Enabling SSH Authentication

The final thing we’ll do to secure our server is enable SSH authentication, which will allow us to use SSH keys to authenticate with the server, instead of the traditional password authentication. This is a more secure approach because password authentication involves sending your password over the network, and this makes it vulnerable to being intercepted and cracked. It’s also more convenient since you won’t need to enter it every time you want to login. But before we move on, I’d like to briefly explain how SSH keys work and what makes them more secure.

All SSH keys come in pairs: one private and the other public. The private key is stored locally and needs to be carefully guarded, while the public key is stored on the remote server to which you will be logging in. Anytime you want to connect to the server, it will use the public key to create a challenge, which it will then send over to you, and only you, the holder of the private key, will be able to correctly understand and solve the challenge. Your response is then sent back to the server, and if it’s correct, it’ll grant you access.

You can see if you already have an SSH key by running:

``` bash
ls ~/.ssh
```

If you see any files with the `.pub` extension, then you already have a key generated; otherwise, you can generate one with the following command:

``` bash
ssh-keygen -C "your.email@example.com"
```

Note that we're using the `-C` flag to create a label for our key for easy identification, and it's typical to set it to your email address. When the command runs, it’ll prompt you to enter a path and passphrase, but the default path is fine, and since we won’t be setting up a passphrase, you can just press “enter” for both. This will store both the private and public keys in the `~/.ssh/` directory, and they will be named according to the type of encryption used, the default being RSA authentication. Your private key will be stored in a file called `id_rsa`, while `id_rsa.pub` will hold your public key.

We'll then need to add the newly generated keys to `ssh-agent`, which is a program that caches your private key and provides it to the SSH client program on your behalf. You can do so with the following command:

``` bash
ssh-add ~/.ssh/id_rsa
```

It'll then ask you for a passphrase, but since we didn't set one up, you'll just need to press "enter."

Having our keys generated, we’re now ready to copy our public key over to the remote server using the `ssh-copy-id` command. (If you’re on a Mac, and you don’t have `ssh-copy-id` installed, you can install it using Homebrew with `brew install ssh-copy-id`.) Below is the full `ssh-copy-id` command that will copy our key over to the server:

``` bash
ssh-copy-id -i ~/.ssh/id_rsa.pub -p 23523 bob@xxx.xxx.xxx.xxx
```

This will create a new file called `authorized_keys` on your remote server inside the `~/.ssh` directory and store your public key in it. If you now try to `ssh` into your server, you should be authenticated and logged in without entering your password.

Going through this process might seem a bit tedious and time consuming at first, but after you’ve done it a couple times, it will get easier and hopefully become second nature. Security is important, and the time you spend learning and implementing it is time well spent.

# Summary

To summarize, we made our server more secure by:

1. limiting `root` privileges to just members of the `deployers` group
2. setting a custom port with which to connect
3. disabling `root` login
4. specifying exactly which user is able to login
5. enabling SSH authentication

Of course, this doesn’t mean our server is “unhackable” by any means, but it is significantly more secure than it was before. You can now sleep more peacefully knowing that any future hackers have at least some of their work cut out for them.

In [part 2]({{ root_url }}/blog/2014/03/14/deploying-rails-apps-part-2-setting-up-the-server/), we’ll start setting up the server by installing the technology stack behind Phindee. If you’d like to be notified when its out, feel free to [subscribe](http://www.feedblitz.com/f/?sub=927939), and you'll get the complete post delivered right to your inbox as soon as it's released.
