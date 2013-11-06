(function ($) {
    var el;
    var settings = {};

    var methods = {
        init: function (options) {
            el = this;

            settings = {
                token: false,
                query_param: 'query'
            };

            if (options) {
                $.extend(settings, options);
            }

            if (!settings.token || settings.query_param == '') {
                return this;
            }

            $.getJSON(
                'http://tapirgo.com/api/1/search.json?token=' + settings.token + '&query=' + paramValue(settings.query_param) + '&callback=?', function (data) {
                    if (settings['complete']) {
                        settings.complete()
                    }
                    $.each(data, function (key, val) {
                        document.getElementById('search_results').style.display = "block";
                        document.getElementById('search_results').style.height = "100%";
                        document.getElementById('search_results').style.overflow = "hidden";
                        var str1 = val.content;
                        var str2 = str1.substr(1, 350);
                        str2 = str2.substr(0, Math.min(str2.length, str2.lastIndexOf(" ")));
                        if((val.published_on).substr(5,2) == '01'){var mon = 'JAN'}
                        if((val.published_on).substr(5,2) == '02'){var mon = 'FEB'}
                        if((val.published_on).substr(5,2) == '03'){var mon = 'MAR'}
                        if((val.published_on).substr(5,2) == '04'){var mon = 'APR'}
                        if((val.published_on).substr(5,2) == '05'){var mon = 'MAY'}
                        if((val.published_on).substr(5,2) == '06'){var mon = 'JUN'}
                        if((val.published_on).substr(5,2) == '07'){var mon = 'JUL'}
                        if((val.published_on).substr(5,2) == '08'){var mon = 'AUG'}
                        if((val.published_on).substr(5,2) == '09'){var mon = 'SEP'}
                        if((val.published_on).substr(5,2) == '10'){var mon = 'OCT'}
                        if((val.published_on).substr(5,2) == '11'){var mon = 'NOV'}
                        if((val.published_on).substr(5,2) == '12'){var mon = 'DEC'}
                        el.append('<article>' + '<h1>' + '<a href="' + val.link + '">' + val.title + '</a>' + '</h1>' + '<time pubdate="" datetime="' + (val.published_on) + '-04:00"><span class="month">'+ mon +'</span> <span class="day">'+ (val.published_on).substr(8,2) +'</span> <span class="year">'+ (val.published_on).substr(0,4) +'</span></time><p>' + str2 + '...</p><a href="' + val.link + '">Read on &rarr;</a></article>');
                    });
                }
            );

            return this;
        }
    };

    // Extract the param value from the URL.
    function paramValue(query_param) {
        var results = new RegExp('[\\?&]' + query_param + '=([^&#]*)').exec(window.location.href);
        return results ? results[1] : false;
    }

    $.fn.tapir = function (method) {
        if (methods[method]) {
            return methods[ method ].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist in jQuery-tapir');
        }
    };

})(jQuery);
