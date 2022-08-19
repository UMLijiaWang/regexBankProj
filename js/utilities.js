//====================================================================================
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>    Function Area    <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
//------------------------------------------------------------------------------------

// console Print command
function consolePrint(strSen) {
    if (blnDebugging) {
        console.log(strSen)
    } 
}

// Test button
function test() {
    toolURLBaseLocater()
    console.log(toolURLBase)
}