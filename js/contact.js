{/* <div id="zf_div_aPOXa_DS7PYqa3_oW5xv0hx9BwT-1J5K09yr2t2jJek"></div>
<script type="text/javascript">( */}

function contact() {
    try {
        var f = document.createElement("iframe");
        f.src = 'https://forms.zohopublic.com.au/gr8fuldevelopers/form/ContactUs/formperma/aPOXa_DS7PYqa3_oW5xv0hx9BwT-1J5K09yr2t2jJek?zf_rszfm=1';
        f.style.border = "none";
        f.style.height = "835px";
        f.style.width = "90%";
        f.style.transition = "all 0.5s ease";
        var d = document.getElementById("zf_div_aPOXa_DS7PYqa3_oW5xv0hx9BwT-1J5K09yr2t2jJek");
        d.appendChild(f);
        window.addEventListener('message', function () {
            var evntData = event.data;
            if (evntData && evntData.constructor == String) {
                var zf_ifrm_data = evntData.split("|");
                if (zf_ifrm_data.length == 2) {
                    var zf_perma = zf_ifrm_data[0];
                    var zf_ifrm_ht_nw = (parseInt(zf_ifrm_data[1], 10) + 15) + "px";
                    var iframe = document.getElementById("zf_div_aPOXa_DS7PYqa3_oW5xv0hx9BwT-1J5K09yr2t2jJek").getElementsByTagName("iframe")[0];
                    if ((iframe.src).indexOf('formperma') > 0 && (iframe.src).indexOf(zf_perma) > 0) {
                        var prevIframeHeight = iframe.style.height;
                        if (prevIframeHeight != zf_ifrm_ht_nw) {
                            iframe.style.height = zf_ifrm_ht_nw;
                        }
                    }
                }
            }
        }, false);
    } catch (e) { }
}
) ();
{/* </script> */ }