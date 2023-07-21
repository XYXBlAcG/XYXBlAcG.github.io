	/**
     * 进入全屏
     * @param element
     */
    function requestFullScreen(element) {
        var requestMethod = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullScreen;
        if (requestMethod) {
            requestMethod.call(element);
        } else if (typeof window.ActiveXObject !== "undefined") {
            var wscript = new ActiveXObject("WScript.Shell");
            if (wscript !== null) {
                wscript.SendKeys("{F11}");
            }
        }
    }


    /**
     * 退出全屏
     */
    function exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
    
    document.getElementById('goAmpl').onclick = function () {
        let iframe = document.getElementById("iframe-one");
        requestFullScreen(iframe);
    }
    document.getElementById('outAmpl').onclick = function () {
        let iframe = document.getElementById("iframe-one");
        exitFullscreen(iframe);
    }
