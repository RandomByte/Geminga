
$(document).ready(function () {
    $('.btn').button()


    Geminga.util.API.sApiRoot = $("#linkApiRoot").attr("href");

    if (!(new RegExp("^.*/app/login.html$").test(window.location.pathname))) {
        this.geminga = new Geminga.App();
    } else {
        $('#password').keypress(function (oEvent) {
          if (oEvent.which == 13) {
            $('#loginBtn').click();
            oEvent.preventDefault();
          }
        });

         $('#loginBtn').click(function(oEvent) {
            var $that = $(this);
            $that.button('loading');

            Geminga.util.API.post("login", { password: $('#password').val() },
                function () {
                    window.location.href = "index.html";
                },
                function (sError) {
                    if (sError === "Unauthorized") {
                        this.button('unauthorized');
                    } else {
                        this.button('error');
                    }
                }, $that);

         });
    }
});

Geminga = {};
Geminga.App = function () {
    var oInstance,
        oClass = function () {
            var that = this;

            this.loadResources();
            
            $('#resourceDetailModal').on('show.bs.modal', function (oEvent) {
                var oResource = oEvent.relatedTarget,
                    oBody = "";

                // Title
                $('#resourceDetailModal #resourceTitle').html(oResource.name +
                    " <span id='status'></span>");
                
                that.updateSingleStatus(oResource.id, $('#resourceDetailModal #resourceTitle #status'));

                for (var i = 0; i < oResource.actions.length; i++) {
                    if (i > 0)
                        oBody += "</br></br>"; 

                    switch (oResource.actions[i]) {
                        case "wake":
                            oBody += "<button id='" + oResource.actions[i] + "Btn' type='button' data-loading-text='Waking up...' data-error-text='Wake error' class='btn btn-primary'>" +
                                "<span class='glyphicon glyphicon glyphicon-off'></span> "+
                                "Wake up" +
                            "</button>";
                        break;
                        case "shutdown":
                            oBody += "<button id='" + oResource.actions[i] + "Btn' type='button' data-loading-text='Shutting down...' data-error-text='Shutdown error' class='btn btn-primary'>" +
                                "<span class='glyphicon glyphicon glyphicon-off'></span> "+
                                "Shutdown" +
                            "</button>";
                        break;
                        case "vpn-start":
                            oBody += "<button id='" + oResource.actions[i] + "Btn' type='button' data-loading-text='Starting VPN...' data-error-text='VPN start error' class='btn btn-primary'>" +
                                "<span class='glyphicon glyphicon glyphicon-arrow-up'></span> "+
                                "Start VPN" +
                            "</button>";
                        break;
                        case "vpn-stop":
                            oBody += "<button id='" + oResource.actions[i] + "Btn' type='button' data-loading-text='Stopping VPN...' data-error-text='VPN stop error' class='btn btn-primary'>" +
                                "<span class='glyphicon glyphicon glyphicon-arrow-down'></span> "+
                                "Stop VPN" +
                            "</button>";
                        break;
                    }
                };

                if (oResource.actions.length === 0) {
                     oBody += "<div class='alert alert-info'>No actions configured for " + oResource.name + "</div>";
                }

                // Body
                $('#resourceDetailModal #resourceDetail').html(oBody);

                for (var j = 0; j < oResource.actions.length; j++) {
                     $('#' + oResource.actions[j] + 'Btn').click(function() {
                        var sAction = oResource.actions[j];

                        return function (oEvent) {
                            $(this).button("loading");
                            Geminga.util.API.get(sAction+ "/" + oResource.id,
                                function (oResponse) {
                                    $(this).button("reset");
                                },
                                function (sError) {
                                    if (window.console)
                                        window.console.log(sError);
                                    $(this).button("error");
                                }, this);
                        };
                    }());
                };
            });
        };

    Geminga.App = function() {
        if (!oInstance) {
            oInstance = new oClass();
        };
        return oInstance;
    };

    oClass.prototype = {

        aDynamicResourceColumns: [
            {
                name: "status",
                headerContent:
                    "Status " +
                    "<button type='button' class='btn btn-default btn-xs' id='refreshState'>" +
                      "<span class='glyphicon glyphicon-refresh'></span>" +
                    "</button>",
                postProcessing: function () {
                    $("#resources #refreshState").click(function () {
                        oInstance.updateStatus();
                    });
                }
            }
        ],
        aHiddenColumns: ["id", "mac", "actions"],

        loadResources: function () {

            Geminga.util.API.get("resources",
                function (oResources) {

                    this.oResources = oResources;

                    for (var i = 0; i < oResources.length; i++) {
                        var oResource = oResources[i],
                            sHeaderRow = "",
                            sRow = "",
                            bMacGiven;

                        for (var sProp in oResource) {
                            if (this.aHiddenColumns.indexOf(sProp) === -1) {
                                if (i === 0) // Header
                                    sHeaderRow += "<th id='" + sProp + "'>" + sProp + "</th>";

                                sRow += "<td id='" + sProp + "'>" + oResource[sProp] + "</td>";
                            }
                        }

                        // Append dynamic columns
                        for (var k = 0; k < this.aDynamicResourceColumns.length; k++) {
                            sRow += "<td id='" + this.aDynamicResourceColumns[k].name + "'></td>";
                        };

                        if (i === 0) { // Header
                            for (var l = 0; l < this.aDynamicResourceColumns.length; l++) {
                                sHeaderRow += "<th id'" + this.aDynamicResourceColumns[l].name + ">" +
                                    this.aDynamicResourceColumns[l].headerContent + "</th>";
                            };

                            $("#resources").append("<tr id='header'>" + sHeaderRow + "</tr>");
                        }

                        $("#resources").append("<tr id='" + oResource.id + "'>" + sRow + "</tr>");
                        
                        $("#resources #" + oResource.id).click(function() {
                            var oRes = oResource;
                            return function () {
                                $('#resourceDetailModal').modal('show', oRes);
                            };
                        }());
                    };

                    for (var m = 0; m < this.aDynamicResourceColumns.length; m++) {
                        this.aDynamicResourceColumns[m].postProcessing();
                    };

                    this.updateStatus(); // todo event this!

                },
                function (sError) {
                    // todo errorhandling
                }, this);

        },

        updateStatus: function() {

            for (var i = 0; i < this.oResources.length; i++) {
                var oRes = this.oResources[i];

                $("#" + oRes.id + " #status")
                    .html("<img class='busyIndicator' src='img/spinner.gif'/>");

                Geminga.util.API.get("status/" + oRes.id,
                    function () {
                        var oResource = oRes;
                        return function (oStatus) {
                            $("#" + oResource.id + " #status").html(
                                oStatus.alive ? "<span class='label label-success'>Online</span>" :
                                    "<span class='label label-default'>Offline</span>");
                        } 
                    }(),
                    function (sError) {
                        // todo
                    }, this);

            };
        },

        updateSingleStatus: function (sId, oIndicator) {
            oIndicator.html("<img class='busyIndicator' src='img/spinner.gif'/>");

                Geminga.util.API.get("status/" + sId,
                    function (oStatus) {
                        var sLabelType,
                            sIndicator = "",
                            i, oState;

                        sIndicator += oStatus.alive ? "<span class='label label-success'>Online</span>" :
                            "<span class='label label-default'>Offline</span>";
                        sIndicator += " ";

                        if (oStatus.remoteConnected === undefined) {
                            // Isn't and shouldn't be connected
                            sLabelType = oStatus.alive ? "info" : "default";
                        } else if (oStatus.remoteConnected === false) {
                            sLabelType = oStatus.alive ? "danger" : "default";
                        } else {
                            sLabelType = "success";
                        }
                        sIndicator += "<span class='label label-" + sLabelType + "'>Remote" +
                            (oStatus.remoteConnected ? "" : " not") + " connected</span>";
                        sIndicator += " ";

                        if (oStatus.states) {
                            for (i = oStatus.states.length - 1; i >= 0; i--) {
                                oState = oStatus.states[i];
                                sLabelType = oState.state === 'started' ? "success" : "default";
                                
                                sIndicator += "<span class='label label-" + sLabelType + "'>" +
                                    oState.name + " is " + oState.state + "</span>";
                                
                                if (i > 0)
                                    sIndicator += " ";
                            }
                        }

                        oIndicator.html(sIndicator);
                    },
                    function (sError) {
                        // todo
                    }, this);
        }

    };
    return Geminga.App();
};

Geminga.util = {};
Geminga.util.API = {};

Geminga.util.API.get = function (sUrl, fnOnSuccess, fnOnError, oCallee) {
    Geminga.util.API.send('get', sUrl, undefined, fnOnSuccess, fnOnError, oCallee);
};

Geminga.util.API.post = function (sUrl, oData, fnOnSuccess, fnOnError, oCallee) {
    Geminga.util.API.send('post', sUrl, oData, fnOnSuccess, fnOnError, oCallee);
};

Geminga.util.API.send = function (sType, sUrl, oData, fnOnSuccess, fnOnError, oCallee) {
    jQuery.ajax({
        type: sType,
        url: (Geminga.util.API.sApiRoot || '/api/') + sUrl,
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(oData),
        success: function (oData) {
            fnOnSuccess.call(oCallee || this, oData);
        },
        error: function (oReq, sStatus, sError) {
            var sErrorMsg;

            if (sError === "Unauthorized" && !(new RegExp("^.*/app/login.html$").test(window.location.pathname))) {
                window.location.href = "login.html";
            } else {
                try {
                    sErrorMsg = JSON.parse(oReq.responseText).error;
                } catch (err) {
                    sErrorMsg = sError;
                }

                fnOnError.call(oCallee || this, sErrorMsg, oReq, sStatus, sError);
            }
            
        }
    });
};