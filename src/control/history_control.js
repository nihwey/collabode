import("helpers");
import("utils.*");

import("sqlbase.sqlobj");

import("collab.ace.easysync2.{AttribPool,Changeset}");
import("collab.collab_server");

import("editor.mobile");
import("editor.workspace");

import("pad.model");
import("pad.revisions");

jimport("collabode.history.Revision");
jimport("collabode.Workspace");

jimport("org.eclipse.core.resources.IResource");
jimport("org.eclipse.jdt.core.IPackageFragmentRoot");
jimport("org.eclipse.jdt.core.JavaCore");

jimport("java.io.ByteArrayInputStream");
jimport("java.util.PriorityQueue");

jimport("java.lang.System");

function onStartup() {
  //collab_server.setExtendedHandler("REQUEST_CLUSTERDATA", _onRequestClusterData);
}

function render_history(whoId, projectname) {
  var project = Workspace.accessProject(projectname);
  
  var starts = [];
  var pads = [];
  project.accept(function(resource) {
    if (resource.getType() == IResource.FILE) {
      var padId = whoId + "@" + resource.getFullPath().toString(); // XXX
      model.accessPadGlobal(padId, function(pad) {
        if (pad.exists()) {
          starts.push(pad.getRevisionDate(0).getTime());
          var data = {
            resource: resource,
            revisions: []
          }
          var head = pad.getHeadRevisionNumber();
          for (var rev = 0; rev <= head; rev++) {
            if (pad.getRevisionAuthor(rev) == "#styleq") { continue; }
            data.revisions[rev] = {
              revision: rev,
              date: pad.getRevisionDate(rev),
              changeset: pad.getRevisionChangeset(rev),
              author: pad.getRevisionAuthor(rewv)
            };
          }
          pads.push(data)
        }
      });
    }
    return true;
  });
  
  renderHtml("editor/history.ejs", {
    project: project,
    whoId: whoId,
    pads: pads,
    start: Math.min.apply(Math, starts)
  });
  return true;
}

function render_pad_history(padId) {
  response.setContentType('text/plain');
  var head;
  model.accessPadGlobal(padId, function(pad) {
    head = pad.getHeadRevisionNumber();
  });
  for (var rev = 0; rev <= head; rev++) {
    model.accessPadGlobal(padId, function(pad) {
      if (pad.getRevisionAuthor(rev) == "#styleq") { return; }
      response.write(rev);
      var date = pad.getRevisionDate(rev);
      response.write("\t" + (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + "\t" + pad.getRevisionAuthor(rev));
      response.write("\n");
      if (pad.getRevisionAuthor(rev) == "") {
        response.write(pad.getRevisionChangeset(rev));
        response.write("<<<<\n");
      }
    });
  }
  for (var rev = 0; rev <= head; rev++) {
    model.accessPadGlobal(padId, function(pad) {
      if (pad.getRevisionAuthor(rev) == "#styleq") { return; }
      response.write(rev);
      response.write("\n");
    });
  }
  return true;
}

function render_version(whoId, projectname, filename, lineNo) {
  var project = Workspace.accessProject(projectname);
  var resource = project.findMember(filename);
  var padId = whoId + "@" + resource.getFullPath().toString(); // XXX
  
  model.accessPadGlobal(padId, function(pad) {
    response.setContentType('text/plain');
    response.write(pad.getRevisionText(lineNo));
  });
  
  return true;
}

function render_replay(whoId, defaultId, projectname, filename, rev) {
  var project = Workspace.accessProject(projectname);
  var resource = project.findMember(filename);
  var sourcePadId = whoId + "@" + resource.getFullPath().toString(); // XXX
  
  if (rev == 0) {
    model.accessPadGlobal(sourcePadId, function(sourcePad) {
      System.out.println("Setting disk contents to revision 0");
      resource.setContents(new ByteArrayInputStream(new java.lang.String(sourcePad.getRevisionText(0)).getBytes()), false, true, null);
    });
  }
  model.accessPadGlobal(sourcePadId, function(sourcePad) {
    var author = sourcePad.getRevisionAuthor(rev);
    if (author == "#styleq") {
      //System.out.println("Skipping syntax color revision " + rev);
    } else {
      if (author == "" || ! author) {
        author = defaultId;
      }
      var targetPadId = workspace.accessDocumentPad(author, resource);
      model.accessPadGlobal(targetPadId, function(targetPad) {
        var cs = sourcePad.getRevisionChangeset(rev);
        // remove attributes
        cs = Changeset.mapAttribNumbers(cs, function() { return false; });
        // merge
        var unpacked = Changeset.unpack(cs);
        var assem = Changeset.smartOpAssembler();
        var iter = Changeset.opIterator(unpacked.ops);
        while (iter.hasNext()) {
          assem.append(iter.next());
        }
        assem.endDocument();
        cs = Changeset.pack(unpacked.oldLen, unpacked.newLen, assem.toString(), unpacked.charBank);

        System.out.println("## Applying revision " + rev + " " + cs + "#!#!#!#!");
        workspace.accessDocumentPad(author, resource);
        collab_server.applyChangesetToPad(targetPad,
                                          cs,
                                          author);
      });
    }
  });
  
  java.lang.Thread.sleep(100);
  return true;
}
/*
function render_replay_mobile(whoId, defaultId, projectname, filename, rev) {
  // NOTE: rev is no longer used, at least for now
  
  // This is a total hack because I can't figure out how the real url args work -__-
  rev = filename;
  filename = projectname.substring(projectname.indexOf("/"), projectname.length) 
  projectname = projectname.substring(0, projectname.indexOf("/"));
  
  System.out.println("----");
  System.out.println("whoId: " + whoId);
  System.out.println("defaultId: " + defaultId);
  System.out.println("projectname: " + projectname);
  System.out.println("filename: " + filename);
  System.out.println("rev: " + rev);
  
  // Get a padId for this... is it a pad yet? D:
  var padId = workspace.replayPadIdFor(whoId, filename);
  System.out.println("padId: " + padId);
  addPadClientVars(padId);
  
  // Now that we've parsed the resource names from the url,
  // get the actual resources
  var project = Workspace.accessProject(projectname);
  var resource = project.findMember(filename);
  var sourcePadId = whoId + "@" + resource.getFullPath().toString(); // XXX
  System.out.println("sourcePadId: " + sourcePadId);
  
  // Apparently the ... file? needs to be zeroed out on revision 0.  XXX Why?
  if (rev == 0) {
    model.accessPadGlobal(sourcePadId, function(sourcePad) {
      System.out.println("Setting disk contents to revision 0");
      resource.setContents(new ByteArrayInputStream(new java.lang.String(sourcePad.getRevisionText(0)).getBytes()), false, true, null);
    });
  }
  
  //cycle(whoId, defaultId, projectname, filename);
  
  renderHtml("replay.ejs", {
    project: project
  });
  return true;
}

function cycle(whoId, defaultId, projectname, filename) {
  model.accessPadGlobal(sourcePadId, function(sourcePad) {
    
    // Determine the target pad id, where the replays will be written
    // Destory and recreate any previous target pads
    var targetPadId = padId; // TODO: uhhh
    System.out.println("targetPadId: " + targetPadId);
    model.accessPadGlobal(targetPadId, function(targetPad) {
      
      // Note: This has been revised to just not deal with the workspace.
      
      // If a pad with the target pad id exists, destroy it
      // and recreate it
      if (targetPad.exists()) {
        targetPad.destroy();
      }
      targetPad.create(false);
    });
    
    // TODO: cycle through all the revisions up until the most recent
    var rev = sourcePad.getHeadRevisionNumber();
    for (var r = 0; r <= rev; r++) {
      
      System.out.println("");
      
      var author = sourcePad.getRevisionAuthor(r);
      
      // Skip syntax coloring
      if (author == "#styleq") {
        //System.out.println("Skipping syntax color revision " + r);
        continue;
      }
      
      // Determine the author otherwise set the author to the defaultId
      if (author == "" || ! author) {
        author = defaultId;
      }
      
      // Access the target pad (which should now exist) and start doing stuff
      model.accessPadGlobal(targetPadId, function(targetPad) {
        
        if ( ! targetPad.exists() ) { // just in case?
          pad.create(false);
        }
        
        var cs = sourcePad.getRevisionChangeset(r);
        // remove attributes
        cs = Changeset.mapAttribNumbers(cs, function() { return false; });
        // merge
        var unpacked = Changeset.unpack(cs);
        var assem = Changeset.smartOpAssembler();
        var iter = Changeset.opIterator(unpacked.ops);
        while (iter.hasNext()) {
          assem.append(iter.next());
        }
        assem.endDocument();
        cs = Changeset.pack(unpacked.oldLen, unpacked.newLen, assem.toString(), unpacked.charBank);
  
        System.out.println("## Applying revision " + r + " " + cs + "#!#!#!#!");
        //workspace.accessReplayPad(whoId, filename);
        collab_server.applyChangesetToPad(targetPad,
                                          cs,
                                          author);
        //collab_server.setPadText(targetPad, sourcePad.getRevisionText(r));
        
        java.lang.Thread.sleep(100);
        //Workspace.scheduleTask("runningOutput", id, file, text, "STDOUT", attribs);
        //response.setContentType('text/plain');
        //response.write(targetPad.getRevisionText(r));
        
      }); // end: access to target pad
    } // end: access to source pad
  });
  return true;
}*/

/////////////////////////////////////////////
// Real replay stuff
function replayAll() {
  
  //System.out.println("Replaying...");
  
  var pq = new PriorityQueue();
  
  var verbose = false;
  
  var projects = Workspace.listProjects();
  for (var p in projects) {
    var project = projects[p];
    if (project.hasNature("org.eclipse.jdt.core.javanature")) {
      var jproject = JavaCore.create(project);
      if (verbose) System.out.println(jproject.getElementName());
      
      var projectName = jproject.getElementName();
      var session = projectName.split("-")[0];
      var username = projectName.split("-")[1];
      
      if (username != null) {              
        mobile.doMobileLogin(username, username);
      }
      
      packages = jproject.getPackageFragments();

      for (var pp in packages) {
        var ppackage = packages[pp]; 
        if (ppackage.getKind() == IPackageFragmentRoot.K_SOURCE) {
          if (verbose) System.out.println("  src/");

          var units = ppackage.getCompilationUnits();
          for (var u in units) {
            var unit = units[u];
            if (verbose) System.out.println("    -> " + unit.getElementName());
            if (verbose) System.out.println(unit.getPath().toString());
            
            var filename = unit.getPath().toString();
            filename = filename.substring(1, filename.length); // remove first /
            filename = filename.substring(filename.indexOf("/"), filename.length); // trim off project name
            // Generate replays if they don't already exist
            handleReplay("choir", username, session, projectName, 
                filename, pq);
          }
        }
      }
    }
  }
  
  // Great!  Theoretically all the changesets that could have been packaged up
  // have been saved into the priority queue.
  // Now go through the priority queue and apply these changes!
  
  //System.out.println();
  System.out.println("Playback -- " + pq.size() + " revisions");
  while (pq.peek() != null) {
    playback(pq.poll());
  }
  
  // after the revision is done playing, check the consoles
  // TODO: if this ends up being useful, move the code to do stuff in the 
  // mobile interface in real time
//  postprocess();
//  renderConsoleOutputView();
  return true;
}

function renderConsoleOutputView() {
  
  var allStudentReplays = sqlobj.selectMulti("REPLAYS", {});
  var start;
  var end;
  
  for (var r in allStudentReplays) {
    var replay = allStudentReplays[r];
    if (replay.startRevisionTime < start || start == null) {
      start = replay.startRevisionTime;
    }
    if (replay.endRevisionTime < end || end == null) {
      end = replay.endRevisionTime;
    }
  }
//  System.out.println(start);
//  System.out.println(end);
  
  // Render the outputGlobs map to a page
  renderHtml("mobile/outputGlobs.ejs", {
    outputGlobs: {},
    startTimestamp: start,
    endTimestamp: end
  });
}

function postprocess() {
  //get all users, each source file, and same -- assume there's a console pad
  System.out.println("Post-processing...");
  
  var outputGlobs = {};
  
  // Go through PROJECTS -- one per student
  var projects = Workspace.listProjects();
  for (var p in projects) {
    var project = projects[p];
    if (project.hasNature("org.eclipse.jdt.core.javanature")) {
      var jproject = JavaCore.create(project);
      //System.out.println(jproject.getElementName());
      
      var projectName = jproject.getElementName();
      //var session = projectName.split("-")[0];
      var username = projectName.split("-")[1];
      
      // Go through PACKAGES to find source folder
      packages = jproject.getPackageFragments();
      for (var pp in packages) {
        var ppackage = packages[pp]; 
        if (ppackage.getKind() == IPackageFragmentRoot.K_SOURCE) {
          //System.out.println("  src/");

          // Get all SOURCE FILES 
          var units = ppackage.getCompilationUnits();
          for (var u in units) {
            var unit = units[u];
            var sourceFileName = unit.getElementName();
            //System.out.println("    -> " + sourceFileName);

            if (outputGlobs[sourceFileName] == null) {
              outputGlobs[sourceFileName] = {};
            }
            
            // get the console pads for each source file (assume they exist)
            var consolePadId = "choir*run*" + unit.getPath().toString();

            try {              
              model.accessPadGlobal(consolePadId, function(pad) {
                var fileGlobs = outputGlobs[sourceFileName];
                var text = pad.text();
                // trim out the start and end, which will always be different!
                var firstEndBracket = text.indexOf("]");
                var lastStartBracket = text.lastIndexOf("[");
                text = text.substring(firstEndBracket+1, lastStartBracket);
                text = text.replace(/^\s+|\s+$/g,''); // trim whitespace from front and back
                //text = text.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

                if (fileGlobs[text] != null) {
                  fileGlobs[text].count++;
                } else {
                  fileGlobs[text] = {
                      text: text,
                      count: 1,
                      authors: new Array()
                  };
                }
                (fileGlobs[text].authors).push(username);
              });
            } catch(e) {
              //System.out.println("no console pad");
            }
          }
        }
      }
    }
  }
  
  // Sort the results by number of occurrences and prepare a friendlier
  // JSONifiable object
  // TODO: Javascript doesn't have a sorted hash map structure... does it?
  // If it does, this whole chunk can be avoided.
  var sortedOutputGlobs = {};
  for (var file in outputGlobs) {
    sortedOutputGlobs[file] = new Array();
    
    var numFileGlobs = 0;
    for (var i in outputGlobs[file]) {
      numFileGlobs++;
    }
    
    while (sortedOutputGlobs[file].length < numFileGlobs) {
      // repeatedly find the glob with the most occurrences and append it
      // in sorted order to the list
      var maxOccurrencesGlob = { count: 0 };
      for (var glob in outputGlobs[file]) {
        var globInfo = outputGlobs[file][glob];
        if (globInfo.count > maxOccurrencesGlob.count) {
          maxOccurrencesGlob = { // make a copy
              text: globInfo.text,
              count: globInfo.count,
              authors: globInfo.authors
          };
        }
      }
      outputGlobs[file][maxOccurrencesGlob.text].count = -1;
      sortedOutputGlobs[file].push(maxOccurrencesGlob);
    }
  }
  
  // Render the outputGlobs map to a page
  renderHtml("mobile/outputGlobs.ejs", {
    outputGlobs: sortedOutputGlobs
  });
}

function handleReplay(whoId, defaultId, session, projectname, filename, pq) {
  /*
  //This is a total hack because I can't figure out how the real url args work -__-
  rev = filename;
  filename = projectname.substring(projectname.indexOf("/"), projectname.length) 
  projectname = projectname.substring(0, projectname.indexOf("/"));
  var session = projectname.substring(0, projectname.indexOf("-"));
  
  System.out.println("----");
  System.out.println("whoId: " + whoId);
  System.out.println("defaultId: " + defaultId);
  System.out.println("session: " + session);
  System.out.println("projectname: " + projectname);
  System.out.println("filename: " + filename);
  */
  
  //Get a padId for this...
  //var padId = workspace.replayPadIdFor(whoId, filename);
  //System.out.println("padId: " + padId);
  
  // Now that we've parsed the resource names from the url,
  // get the actual resources
  var project = Workspace.accessProject(projectname);
  var resource = project.findMember(filename);
  var sourcePadId = whoId + "@" + resource.getFullPath().toString(); // XXX
  var sourceConsolePadId = whoId + "*run*" + resource.getFullPath().toString();
  //System.out.println("sourcePadId: " + sourcePadId);
  //System.out.println("sourceConsolePadId: " + sourceConsolePadId);
  
  initReplay(session, sourcePadId, whoId, defaultId, pq);
  initReplay(session, sourceConsolePadId, whoId, defaultId, pq);
}

function initReplay(session, padId, whoId, defaultId, pq) {
  var replay;
  var replayId;
  
  try {

    // Look up replayId in db
    replay = sqlobj.selectSingle("REPLAYS", {
      session: session,
      padId: padId
    });
    
    if (replay == null) {
      // This replay hasn't been recorded yet.
      try {
        replayId = generateReplay(session, padId, whoId, defaultId);
        System.out.println("Generated replay " + replayId);
        
      } catch (e) {
        //System.out.println("GENERATE ERROR: " + e);
      }

    } else {    
      // This replay has been recorded, just return its id
      //System.out.println("Replay exists! skipping..");
      replayId = replay.replayId;
    }
    
    // Go through all the replays and insert them into a priority queue
    // by timestamp so they can be played back in order.    
    var revs = sqlobj.selectMulti("REPLAY_DATA", { replayId: replayId });
    for (var r in revs) {
      /*System.out.println(r + " " + revs[r].revisionNum + ": " + 
          revs[r].timestamp + " " +
          revs[r].changeset + " " +
          revs[r].action);*/
      pq.add(new Revision(
          padId,
          revs[r].revisionNum, 
          revs[r].author,
          revs[r].timestamp,
          revs[r].changeset,
          revs[r].action,
          replayId,
          revs[r].id));
    }
    
//    System.out.println("done! pq size: " + pq.size());
  } catch (e) {
    //System.out.println("ERROR: " + e);
  }
  
}

function generateReplay(session, padId, whoId, defaultId) {
  //System.out.println("No replay exists for " + session + " - " + padId + " generating..");

  var replay;
  
  // Get head revision number from db
  model.accessPadGlobal(padId, function(sourcePad) {
    // Generate a replayId and add this item to the db
    var headRevision = sourcePad.getHeadRevisionNumber(); 
    
    // XXX Ugly, this is 2 db accesses just to get the auto-incremented replayId.
    // Might want to come up with a naming pattern for replayIds
    sqlobj.insert("REPLAYS", {
      session: session,
      padId: padId,
      headRevision: headRevision,
      endRevisionTime: sourcePad.getRevisionDate(headRevision),
      startRevisionTime: sourcePad.getRevisionDate(0)
    });

    replay = sqlobj.selectSingle("REPLAYS", {
      session: session,
      padId: padId
    });
    
    /* XXX: Wow.
    if (replay == null) {
      System.out.println("... this happens?!");
      setTimeout(function() {
        replay = sqlobj.selectSingle("REPLAYS", {
          session: session,
          padId: padId
        });
      }, 100);
    }*/
    
    var timestamp = "unknown";
    for (var rev = 0; rev < headRevision; rev++) {
      
      var author = sourcePad.getRevisionAuthor(rev);
      
      // Skip syntax coloring
      if (author == "#styleq") {
        //System.out.println("Skipping syntax color revision " + rev);
        continue;
      }
      
      // Determine the author otherwise set the author to the defaultId
      if (author == "" || ! author) {
        author = defaultId;
      }
        
      var cs = sourcePad.getRevisionChangeset(rev);
      // remove attributes
      cs = Changeset.mapAttribNumbers(cs, function() { return false; });
      // merge
      var unpacked = Changeset.unpack(cs);
      var assem = Changeset.smartOpAssembler();
      var iter = Changeset.opIterator(unpacked.ops);
      while (iter.hasNext()) {
        assem.append(iter.next());
      }
      assem.endDocument();
      cs = Changeset.pack(unpacked.oldLen, unpacked.newLen, assem.toString(), unpacked.charBank);
  
      //System.out.println("## revision " + rev + " " + cs + "#!#!#!#!");

      var csText = cs.substring(cs.indexOf("$")+1, cs.length);
      //System.out.println(rev + ": " + csText);
      var action = "UNKNOWN";
      if (csText.indexOf("[ Started") == 1 /*&& 
          csText.indexOf(" ]") == csText.length-2*/) {
        action = "RUN";
        //timestamp = csText.substring(csText.indexOf("[ Started ") + "[ Started ".length,
            //csText.indexOf(" ]"));
      } else {
        action = "WRITE";
      }
      sqlobj.insert("REPLAY_DATA", {
        replayId: replay.replayId,
        padId: replay.padId,
        revisionNum: rev,
        author: defaultId,
        timestamp: sourcePad.getRevisionDate(rev),
        changeset: cs,
        action: action
      });
    }
  });
  
  return replay.replayId;      
  
  // At the end... // safeguards should exist to make this whole thing fault-tolerant
    // so that at any point if the replay generation gets stopped the entire thing 
    // doesn't fail
  // Save replayId with head revision number to db
}

function playback(rev) { // rev is a single Java Revision object
  if (rev.action == "WRITE") {
    workspace.replayTaskRunningOutput(rev.author, rev.padId, rev.cs);

  } else if (rev.action == "RUN") {
    workspace.replayOnRunRequest(rev.padId, rev.author);
  }
  
  computeCluster(rev);
}

function computeCluster(rev) {
  //if this is a console pad and it hasn't already been done, 
  // capture the console output and precompute a cluster for it
  if (rev.padId.indexOf("*run*") != -1) {
//    var consoleOutput = sqlobj.selectSingle("REPLAY_CONSOLE_OUTPUTS", {
//      replayDataId: rev.replayId
//    });
    var replayDataItem = sqlobj.selectSingle("REPLAY_DATA", {
      id: rev.replayDataId
    });
    if (replayDataItem.clusterId == null) {    
      // access the console pad, get its text, and assign a cluster id to it
      var text;
      model.accessPadGlobal(rev.padId, function(pad) {
//      var fileGlobs = outputGlobs[sourceFileName];
        text = pad.text();
        // trim out the start and end, which will always be different!
        var firstEndBracket = text.indexOf("]");
        var lastStartBracket = text.lastIndexOf("[");
        text = text.substring(firstEndBracket+1, lastStartBracket);
        text = text.replace(/^\s+|\s+$/g,''); // trim whitespace from front and back
        //text = text.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
        
//      if (fileGlobs[text] != null) {
//        fileGlobs[text].count++;
//      } else {
//        fileGlobs[text] = {
//            text: text,
//            count: 1,
//            authors: new Array()
//        };
//      }
//      (fileGlobs[text].authors).push(username);
      });
      
      // generate a unique id for this text cluster if it hasn't been seen yet
      var cluster = sqlobj.selectSingle("REPLAY_CLUSTERS", { text: text });
      var clusterId;
      if (cluster == null) {
        sqlobj.insert("REPLAY_CLUSTERS", { text: text });
        clusterId = sqlobj.selectSingle("REPLAY_CLUSTERS", { text: text }).id;
      } else {
        clusterId = cluster.id;
      }
      
      // insert this output into the db with its cluster id
//      sqlobj.insert("REPLAY_CONSOLE_OUTPUTS", {
//        replayDataId: rev.replayId,
//        clusterId: clusterId
//      });
      System.out.println("computed cluster " + clusterId);
      sqlobj.update("REPLAY_DATA", {
        id: rev.replayDataId
      }, {
        clusterId: clusterId
      });
    }
//    else {
//      System.out.println(replayDataItem.id + " " + replayDataItem.author + ": " + replayDataItem.clusterId);
//    }
  }
}

function renderClusterProgressions() {  
  var allreplays = sqlobj.selectMulti("REPLAY_DATA", {});
  var allclusters = sqlobj.selectMulti("REPLAY_CLUSTERS", {});
  
  var replays = [];
  for (var i in allreplays) {
    if (allreplays[i].clusterId != null) {
      replays.push(allreplays[i]);
    }
  }
  
  renderHtml("mobile/clustergraph.ejs", {
    replays: replays,
    clusters: allclusters
  });
  return true;
}

function _onRequestClusterData() {
  // run through all the clusters stored in REPLAY_DATA
  // store a point for each data point
  // render the {id: cluster} map separately
  var allreplays = sqlobj.selectMulti("REPLAY_DATA", {});
  var allclusters = sqlobj.selectMulti("REPLAY_CLUSTERS", {});
  

  
  collab_server.sendConnectionExtendedMessage(connectionId, {
    type: "CLUSTERDATA",
    replays: allreplays,
    clusters: allclusters
  });
}
