
//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    Env Setting    <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//------------------------------------------------------------------------------------
blnDebugging = true
blnLocalhost = false
blnReloadDB = false
blnTestbutton = false

//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    Function Area    <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//------------------------------------------------------------------------------------

// Function to enable the configuration options checkboxes
function behaviorConfigDiv(e, t) {
    if (t.is(':checked')) {
        $(e).removeAttr('hidden');
        blnDebugging = true
        consolePrint("Debugging on.")      
        
    } else {
        $(e).attr('hidden', true);
        consolePrint("Debugging off.")  
        blnDebugging = false              
    }
}

// Function about the behavior of the localhost checkbox
function behaviorLocalhost() {
    checkConfig()
    if (blnLocalhost) {
        // if (document.location.hostname == "localhost") {
        //     toolURLBaseTest = "https://localhost:8080/" 
        //     return
        // }        
    }    
}

// Function about the behavior of the reload DB checkbox
function behaviorReloadDB() {
    checkConfig()
    if (blnReloadDB) {

        return
    }
}

// Function about the behavior of the test button checkbox function
function behaviorTestButton() {
    checkConfig()
    if (blnTestbutton) {
        $("#testBtn").show()
        return
    }
    $("#testBtn").hide()
}

// Check and update the Configuration
function checkConfig() {
    if ($("#configCheckBox1").is(':checked')) {
        blnLocalhost = true
        consolePrint("This is a local host.")
    } else {
        blnLocalhost = false
        consolePrint("This is a nodeJS app.")
    }
    if ($("#configCheckBox2").is(':checked')) {
        blnReloadDB = true
        consolePrint("RegEx Bank will be reload!")
    } else {
        blnReloadDB = false
        consolePrint("Preloaded RegEx Bank will be used!")
    }
    if ($("#configCheckBox3").is(':checked')) {
        blnTestbutton = true
        consolePrint("Test button is enable!")
    } else {
        blnTestbutton = false
        consolePrint("Test button is disable!")
    }
}

