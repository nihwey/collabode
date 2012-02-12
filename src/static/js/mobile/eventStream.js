function EventStream(parent) {
  var containerId = "#student-details-panel-right";
  var contentId = containerId + "-content";
  var topOverlayId = containerId + "-overlay-top";
  var botOverlayId = containerId + "-overlay-bottom";
  var $container = $(containerId);
  var $content = $(contentId);
  var $topOverlay = $(topOverlayId);
  var $botOverlay = $(botOverlayId);
  var $parent = parent;
  
  this.username = null;
  
  /*=====================
   * Initialization code
   */
  $topOverlay.hide();
  $botOverlay.hide();  
  
  /*=====================
   * Helper functions
   */   
  this.getContentObj = function() {
    return $content;
  }
  
  function _applyOverlay($overlay) {
    $overlay.show();
  }
  function _hideOverlay($overlay) {
    $overlay.hide();
  }
  
  var contentScroller = new iScroll("student-details-panel-right", {
    hScroll: false,
    hScrollbar: false,
    vScrollbar: true
  });
  
  /*
  $container.bind("swipeup", function(e) {
    var top = parseInt($content.css('top'));
    
    // Perform the scroll
    $content.animate({
      top: top <= -($content.height()-$container.height())
          ? -$content.height()
          : top-500 + "px"
    });
    
    // Add a shadow as an affordance for scrolling to view hidden items 
    if (parseInt($content.css('top'))-500 < 0) {
      _applyOverlay($topOverlay);
    } else {
      _hideOverlay($topOverlay);
    }
  });
  
  $container.bind("swipedown", function(e) {
    var top = parseInt($content.css('top'));

    // Perform the scroll
    $content.animate({
      top: top == 0
          ? "0px" 
          : Math.min(0,top+500) + "px"
    });
    
    // Add a shadow as an affordance for scrolling to view hidden items 
    if (Math.min(0,parseInt($content.css('top')))+500 < 0) {
      _applyOverlay($topOverlay);
    } else {
      _hideOverlay($topOverlay);
    }
  });
  */
  
  /*===================
   * Public functions
   */
  this.updateStream = function(username) {
    // Redraw the event stream if this is a different user than before.
    // This allows us to simply update the stream with new events if the
    // user hasn't changed, but also doesn't accidentally keep adding events
    // universally across users.
    if (this.username != username) {
      this.username = username;
      $content.empty();
    }
  }
  
  function appendEventToStream(eventClass, eventId, html) {
    var event = $("<div class='event'/>")
      .attr('id', eventId)
      .addClass(eventClass)
      .append(html);
    if (eventClass == "notEvent") {
      event.removeClass("event");
    }
    $content.prepend(event);
  }
  
  var lastEventTime = null;
  this.logEvent = function(data) {
    // Determine which type of event this is
    var eventClass = "";
    if (data.runException != null) {
      eventClass = "exception";
    }
    
    // Determine the id for this event
    var eventId = "event-" + $('.event').length;
    
    // Create the HTML contents of of the event item based on its
    // event class
    if (lastEventTime != null && (Number(data.runTime)-600000 > lastEventTime)) {
      appendEventToStream("notEvent", "notEvent", "<p style='text-align:center;'>//</p>");
    }
    var html = $('<p/>')
      .append('<span style="color: #888;">'+new Date(Number(data.runTime)+18000000).format("shortTime")+' - </span>');
      //.append(" - ");
    lastEventTime = Number(data.runTime);
    
    switch(eventClass) {
    // Runs that resulted in an exception being thrown
    case "exception":
      var exceptionSpan = $('<span class="exceptionName"/>')
        .append(data.runException)
        .click(function() {
          requestSimilarExceptions(eventId, data.runException);
        });
      html
        .append(exceptionSpan)
        .append("<br>")
        .append(data.padId.substring("choir*run*/".length, 
            data.padId.length));
      break;
      
    // Regular runs
    default:
      html.append("Successful run");
    }
    html.append(" [<a href='../console/HelloWorld/src/First.java' target='mobile_console'>View console</a>]");
    appendEventToStream(eventClass, eventId, html);
  }
  
  /** 
   * If it has not already been done, create an object holding photos of 
   * users sharing the same exception, and put it into the correct event 
   * item in the stream.  Otherwise just hide it.
   */
  this.showUsersWithSimilarExceptions = function(data) {

    var eventObj = $('#' + data.streamEventId);
    
    if (eventObj.find('div.similarExceptions').length == 0) {
      // Create the actual object
      var similarExceptionsUsers = $('<div class="similarExceptions"/>');
      // Attach a photo of each user
      for (var i in data.users) {
        if (data.users[i] != this.parent.data.user.username){          
          var userPhoto = $('.card[data-username="'+ data.users[i] +'"] img.photo').attr('src');
          similarExceptionsUsers.append($('<img class="tiny">')
              .attr("src", userPhoto));
        }
      }
      // Provide a link to filter these students out
      var seeAll = $('<span/>');
      if (data.users.length > 1) {        
        if (data.users.length == 2) {
          seeAll.append("1 other user ");
        } else if (data.users.length > 1) {
          seeAll.append(data.users.length-1 + " other users ");
        }
        seeAll.append(" got this exception. <u>See all</u> &gt;&gt;");
        seeAll.click(function() {
          $parent.hide();
          cardTray.filterCards(data.users);
        })
      } else {
        seeAll.append("No other users have gotten this exception.");
      }
      similarExceptionsUsers.append(seeAll);
      
      // Append it to the stream element
      eventObj.append(similarExceptionsUsers);   
    } else {
      eventObj.find('div.similarExceptions').detach();
    }
    
  }
  
  return this;
}