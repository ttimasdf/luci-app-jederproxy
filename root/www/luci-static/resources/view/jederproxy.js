'use strict';
'require view';
'require uci';
'require rpc';
'require form';
'require fs';
'require ui';
'require network';
'require tools.widgets as widgets';

var callInitList, callInitAction, ServiceController;

const FEATURE_FLAGS = {
    have_fw3: false,  // %FLAG_NO_FW3% managed by build system
    have_fw4: false,  // %FLAG_NO_FW4% managed by build system
    // %FLAG_FW3% have_fw3: true,  // uncomment by build system on fw3
    // %FLAG_FW4% have_fw4: true,  // uncomment by build system on fw4
};

callInitList = rpc.declare({
    object: 'luci',
    method: 'getInitList',
    params: [ 'name' ],
    expect: { '': {} }
}),

callInitAction = rpc.declare({
    object: 'luci',
    method: 'setInitAction',
    params: [ 'name', 'action' ],
    expect: { result: false }
});


function add_flow_and_stream_security_conf(s, tab_name, depends_field_name, protocol_name, have_xtls, have_tls_flow, is_outbound_protocol) {
    let o = s.taboption(tab_name, form.ListValue, `${protocol_name}_tls`, _(`[${protocol_name}] Stream Security`))
    let odep = {}
    odep[depends_field_name] = protocol_name
    if (is_outbound_protocol) {
        o.depends(depends_field_name, protocol_name)
        o.value("none", "None")
    } else {
        odep["web_server_enable"] = "1"
    }
    o.value("tls", "TLS")
    if (have_xtls) {
        if (protocol_name == "vless" && FEATURE_FLAGS.have_fw4) {
            o.value("reality", "REALITY")
        }
        o.value("xtls", "XTLS [deprecated]")
    }
    o.depends(odep)
    o.rmempty = false
    o.modalonly = true

    if (have_xtls) {
        o = s.taboption(tab_name, form.ListValue, `${protocol_name}_flow`, _(`[${protocol_name}][xtls] Flow`))
        let odep = {}
        odep[depends_field_name] = protocol_name
        odep[`${protocol_name}_tls`] = "xtls"
        o.value("none", "none")
        o.value("xtls-rprx-origin", "xtls-rprx-origin")
        o.value("xtls-rprx-origin-udp443", "xtls-rprx-origin-udp443")
        o.value("xtls-rprx-direct", "xtls-rprx-direct")
        o.value("xtls-rprx-direct-udp443", "xtls-rprx-direct-udp443")
        if (is_outbound_protocol) {
            o.value("xtls-rprx-splice", "xtls-rprx-splice")
            o.value("xtls-rprx-splice-udp443", "xtls-rprx-splice-udp443")
        } else {
            odep["web_server_enable"] = "1"
        }
        o.depends(odep)
        o.rmempty = false
        o.modalonly = true
    }

    if (have_tls_flow) {
        o = s.taboption(tab_name, form.ListValue, `${protocol_name}_flow_tls`, _(`[${protocol_name}][tls] Flow`))
        let odep = {}
        odep[depends_field_name] = protocol_name
        odep[`${protocol_name}_tls`] = /^(tls|reality)$/
        o.value("none", "none")
        o.value("xtls-rprx-vision", "xtls-rprx-vision")
        o.value("xtls-rprx-vision-udp443", "xtls-rprx-vision-udp443")
        if (is_outbound_protocol) {
            // wait for some other things
        } else {
            odep["web_server_enable"] = "1"
        }
        o.depends(odep)
        o.rmempty = false
        o.modalonly = true
    }

    if (is_outbound_protocol) {
        o = s.taboption(tab_name, form.Value, `${protocol_name}_tls_host`, _(`[${protocol_name}][tls] Server Name`))
        o.depends(`${protocol_name}_tls`, "tls")
        o.rmempty = true
        o.modalonly = true

        o = s.taboption(tab_name, form.Flag, `${protocol_name}_tls_insecure`, _(`[${protocol_name}][tls] Allow Insecure`))
        o.depends(`${protocol_name}_tls`, "tls")
        o.rmempty = false
        o.modalonly = true

        o = s.taboption(tab_name, form.ListValue, `${protocol_name}_tls_fingerprint`, _(`[${protocol_name}][tls] Fingerprint`))
        o.depends(`${protocol_name}_tls`, /^(tls|reality)$/)
        if (protocol_name == "vless") {
            o.value("chrome", "chrome")
            o.value("firefox", "firefox")
            o.value("safari", "safari")
            o.value("ios", "ios")
            o.value("android", "android")
            o.value("edge", "edge")
            o.value("360", "360")
            o.value("qq", "qq")
        } else {
            o.value("", "(not set)")
            o.value("chrome", "chrome")
            o.value("firefox", "firefox")
            o.value("safari", "safari")
            o.value("randomized", "randomized")
        }
        o.rmempty = true
        o.modalonly = true

        o = s.taboption(tab_name, form.DynamicList, `${protocol_name}_tls_alpn`, _(`[${protocol_name}][tls] ALPN`))
        o.depends(`${protocol_name}_tls`, "tls")
        o.value("h2", "h2")
        o.value("http/1.1", "http/1.1")
        o.rmempty = true
        o.modalonly = true

        if (have_xtls) {
            o = s.taboption(tab_name, form.Value, `${protocol_name}_xtls_host`, _(`[${protocol_name}][xtls] Server Name`))
            o.depends(`${protocol_name}_tls`, "xtls")
            o.rmempty = true
            o.modalonly = true

            o = s.taboption(tab_name, form.Flag, `${protocol_name}_xtls_insecure`, _(`[${protocol_name}][xtls] Allow Insecure`))
            o.depends(`${protocol_name}_tls`, "xtls")
            o.rmempty = false
            o.modalonly = true

            o = s.taboption(tab_name, form.DynamicList, `${protocol_name}_xtls_alpn`, _(`[${protocol_name}][xtls] ALPN`))
            o.depends(`${protocol_name}_tls`, "xtls")
            o.value("h2", "h2")
            o.value("http/1.1", "http/1.1")
            o.rmempty = true
            o.modalonly = true

            if (FEATURE_FLAGS.have_fw4) {
                o = s.taboption(tab_name, form.Value, `${protocol_name}_reality_servername`, _(`[${protocol_name}][reality] SNI Server Name`), _("Valid domain on target host's SSL Certificate, can be retrived from dest host by <code>xray tls ping example.com</code>"))
                o.depends(`${protocol_name}_tls`, "reality")
                o.placeholder = "example.com"
                o.optional = false
                o.rmempty = false
                o.modalonly = true

                o = s.taboption(tab_name, form.Value, `${protocol_name}_reality_publickey`, _(`[${protocol_name}][reality] Public Key`), _("The public key generated by <code>xray x25519</code>"))
                o.depends(`${protocol_name}_tls`, "reality")
                o.optional = false
                o.rmempty = false
                o.modalonly = true

                o = s.taboption(tab_name, form.Value, `${protocol_name}_reality_shortid`, _(`[${protocol_name}][reality] Short ID`))
                o.depends(`${protocol_name}_tls`, "reality")
                o.placeholder = "1234567890abcdef"
                o.rmempty = false
                o.modalonly = true

                o = s.taboption(tab_name, form.Value, `${protocol_name}_reality_spiderx`, _(`[${protocol_name}][reality] SpiderX`), _("This field is subject to change.."))
                o.depends(`${protocol_name}_tls`, "reality")
                o.placeholder = "/"
                o.rmempty = false
                o.modalonly = true
            }
        }
    }
}

function check_resource_files(load_result) {
    let geoip_existence = false;
    let geoip_size = 0;
    let geosite_existence = false;
    let geosite_size = 0;
    let firewall4 = false;
    let xray_bin_default = false;
    let optional_features = {};
    for (const f of load_result) {
        if (f.name == "xray") {
            xray_bin_default = true;
        }
        if (f.name == "geoip.dat") {
            geoip_existence = true;
            geoip_size = '%.2mB'.format(f.size);
        }
        if (f.name == "geosite.dat") {
            geosite_existence = true;
            geosite_size = '%.2mB'.format(f.size);
        }
        if (f.name == "firewall_include.ut") {
            firewall4 = true;
        }
        if (f.name.startsWith("optional_feature_")) {
            optional_features[f.name] = true;
        }
    }
    return {
        geoip_existence: geoip_existence,
        geoip_size: geoip_size,
        geosite_existence: geosite_existence,
        geosite_size: geosite_size,
        optional_features: optional_features,
        firewall4: firewall4,
        xray_bin_default: xray_bin_default,
    }
}

function check_dns_format(_, dns) {
    if (/^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)(\.(?!$)|$)){4}$/.test(dns)) {
        // IPv4 Address
        return true;
    }
    if (/(https|tcp|quic)(\+local)?:\/\/([-\w\d@:%._\+~#=]{1,256}\.[\w\d()]{1,6}\b)(:(\d+))?([-\w\d()@:%_\+.~#?&\/=]*)/.test(dns)) {
        // DoH/TCP/QUIC Server Address
        return true;
    }

    if (dns === "localhost") {
        return true;
    }
    return "Invalid DNS address";
}

ServiceController = form.DummyValue.extend({
    handleAction: function(name, action, ev) {
        return callInitAction(name, action).then(function(success) {
            ui.addNotification(null, E('p', _('Service %s success.').format(action)), 'info');
        }).catch(function (e) {
            ui.addNotification(null, E("p", _('Unable to perform service %s: %s').format(action, e.message)), "error");
        });
    },

    renderWidget: function(section_id, option_id, cfgvalue) {
        return E([], [
            E('span', { 'class': 'control-group' }, [
                E('button', {
                    class: 'btn cbi-button-%s'.format(this.service_enabled ? 'positive' : 'negative'),
                    click: ui.createHandlerFn(this, function() {
                        return callInitAction(this.service_name, this.service_enabled ? "disable": "enable").then(rc => ui.addNotification(null, E('p', _('Toggle startup success.')), 'info'));
                    }),
                    disabled: this.control_disabled
                }, this.service_enabled ? _('Enabled') : _('Disabled')),
                E('button', { 'class': 'btn cbi-button-action', 'click': ui.createHandlerFn(this, 'handleAction', this.service_name, 'start'), 'disabled': this.control_disabled }, _('Start')),
                E('button', { 'class': 'btn cbi-button-action', 'click': ui.createHandlerFn(this, 'handleAction', this.service_name, 'restart'), 'disabled': this.control_disabled }, _('Restart')),
                E('button', { 'class': 'btn cbi-button-action', 'click': ui.createHandlerFn(this, 'handleAction', this.service_name, 'stop'), 'disabled': this.control_disabled }, _('Stop'))
            ])
        ]);
    },
});

return view.extend({
    handleServiceReload: function (ev) {
        return callInitAction("jederproxy", "restart").then(function(rc) {
            ui.addNotification(null, E('p', _('Reload service success.')), 'info');
        }).catch(function (e) {
            ui.addNotification(null, E("p", _('Unable to reload service: %s').format(e.message)), "error");
        });
    },

    handleSaveApply: function (ev, mode) {
        return this.__base__.handleSaveApply(ev, mode).then(this.handleServiceReload);
    },

    load: function () {
        return Promise.all([
            uci.load("jederproxy"),
            fs.list("/usr/share/jederproxy"),
            network.getHostHints(),
            L.resolveDefault(fs.read("/var/run/jederproxy.pid"), null),
            callInitList("jederproxy"),
        ])
    },

    render: function (load_result) {
        const config_data = load_result[0];
        const xray_dir = load_result[1];
        const network_hosts = load_result[2];
        const xray_pid = load_result[3];
        const xray_service_status = load_result[4]["jederproxy"];
        const geoip_direct_code = uci.get_first(config_data, "general", "geoip_direct_code");
        const { geoip_existence, geoip_size, geosite_existence, geosite_size, optional_features, firewall4, xray_bin_default } = check_resource_files(xray_dir);
        const status_text = xray_pid ? (_("[Xray is running]") + `[PID:${xray_pid.trim()}]`) : _("[Xray is stopped]");

        let asset_file_status = _('WARNING: at least one of asset files (geoip.dat, geosite.dat) is not found under /usr/share/jederproxy. Xray may not work properly. See <a href="https://github.com/ttimasdf/luci-app-jederproxy">here</a> for help.')
        if (geoip_existence) {
            if (geosite_existence) {
                asset_file_status = _('Asset files check: ') + `geoip.dat ${geoip_size}; geosite.dat ${geosite_size}. ` + _('Report issues or request for features <a href="https://github.com/ttimasdf/luci-app-jederproxy">here</a>.')
            }
        }

        const m = new form.Map('jederproxy', _('Xray'), status_text + " " + asset_file_status);

        var s, o, ss;

        s = m.section(form.TypedSection, 'general');
        s.addremove = false;
        s.anonymous = true;

        s.tab('general', _('General Settings'));

        o = s.taboption('general', form.Value, 'xray_bin', _('Xray Executable Path'))
        o.rmempty = false
        if (xray_bin_default) {
            o.value("/usr/bin/jederproxy", _("/usr/bin/jederproxy (default, exist)"))
        }

        o = s.taboption('general', ServiceController, "_service", _("Service Control"), _("Refresh the page manually for actions to take effect"));
        o.service_name = "jederproxy"
        o.service_enabled = xray_service_status.enabled;
        o.service_index = xray_service_status.index;

        o = s.taboption('general', form.ListValue, 'main_server', _('TCP Server'))
        o.datatype = "uciname"
        o.value("disabled", _("Disabled"))
        for (const v of uci.sections(config_data, "servers")) {
            o.value(v[".name"], v.alias || v.server + ":" + v.server_port)
        }

        o = s.taboption('general', form.ListValue, 'tproxy_udp_server', _('UDP Server'))
        o.datatype = "uciname"
        o.value("disabled", _("Disabled"))
        for (const v of uci.sections(config_data, "servers")) {
            o.value(v[".name"], v.alias || v.server + ":" + v.server_port)
        }

        o = s.taboption('general', form.Flag, 'dnsmasq_takeover_enable', _('Enable dnsmasq Takeover'), _('Enable this option force using xray dns inbound port as dnsmasq\'s upstream server.'))

        o = s.taboption('general', form.Flag, 'transparent_proxy_enable', _('Enable Transparent Proxy'), _('This enables DNS query forwarding and TProxy for both TCP and UDP connections.'))

        o = s.taboption('general', form.Flag, 'tproxy_sniffing', _('Enable Sniffing'), _('If sniffing is enabled, requests will be routed according to domain settings in "DNS Settings" tab.'))
        o.depends("transparent_proxy_enable", "1")

        o = s.taboption('general', form.Flag, 'route_only', _('Route Only'), _('Use sniffed domain for routing only but still access through IP. Reduces unnecessary DNS requests. See <a href="https://github.com/XTLS/jederproxy-core/commit/a3023e43ef55d4498b1afbc9a7fe7b385138bb1a">here</a> for help.'))
        o.depends({ "transparent_proxy_enable": "1", "tproxy_sniffing": "1" })

        o = s.taboption('general', form.SectionValue, "xray_servers", form.GridSection, 'servers', _('Xray Servers'), _("Servers are referenced by index (order in the following list). Deleting servers may result in changes of upstream servers actually used by proxy and bridge."))
        ss = o.subsection
        ss.sortable = false
        ss.anonymous = true
        ss.addremove = true

        ss.tab('general', _('General Settings'));

        o = ss.taboption('general', form.Value, "alias", _("Alias (optional)"))
        o.rmempty = true

        o = ss.taboption('general', form.Value, 'server', _('Server Hostname'))
        o.datatype = 'host'

        o = ss.taboption('general', form.ListValue, 'domain_strategy', _('Domain Strategy'))
        o.value("UseIP")
        o.value("UseIPv4")
        o.value("UseIPv6")
        o.default = "UseIP"
        o.modalonly = true

        o = ss.taboption('general', form.Value, 'server_port', _('Server Port'))
        o.datatype = 'port'
        o.placeholder = '443'

        o = ss.taboption('general', form.Value, 'password', _('UserId / Password'), _('Fill user_id for vmess / VLESS, or password for shadowsocks / trojan (also supports <a href="https://github.com/XTLS/jederproxy-core/issues/158">Xray UUID Mapping</a>)'))
        o.modalonly = true

        ss.tab('protocol', _('Protocol Settings'));

        o = ss.taboption('protocol', form.ListValue, "protocol", _("Protocol"))
        o.value("vmess", "VMess")
        o.value("vless", "VLESS")
        o.value("trojan", "Trojan")
        o.value("shadowsocks", "Shadowsocks")
        o.rmempty = false

        add_flow_and_stream_security_conf(ss, "protocol", "protocol", "trojan", true, false, true)

        o = ss.taboption('protocol', form.ListValue, "shadowsocks_security", _("[shadowsocks] Encrypt Method"))
        o.depends("protocol", "shadowsocks")
        o.value("none", "none")
        o.value("aes-256-gcm", "aes-256-gcm")
        o.value("aes-128-gcm", "aes-128-gcm")
        o.value("chacha20-poly1305", "chacha20-poly1305")
        o.value("2022-blake3-aes-128-gcm", "2022-blake3-aes-128-gcm")
        o.value("2022-blake3-aes-256-gcm", "2022-blake3-aes-256-gcm")
        o.value("2022-blake3-chacha20-poly1305", "2022-blake3-chacha20-poly1305")
        o.rmempty = false
        o.modalonly = true

        o = ss.taboption('protocol', form.Flag, 'shadowsocks_udp_over_tcp', _('[shadowsocks] UDP over TCP'), _('Only available for shadowsocks-2022 ciphers (2022-*)'))
        o.depends("shadowsocks_security", /2022/)
        o.rmempty = false
        o.modalonly = true

        add_flow_and_stream_security_conf(ss, "protocol", "protocol", "shadowsocks", false, false, true)

        o = ss.taboption('protocol', form.ListValue, "vmess_security", _("[vmess] Encrypt Method"))
        o.depends("protocol", "vmess")
        o.value("none", "none")
        o.value("auto", "auto")
        o.value("aes-128-gcm", "aes-128-gcm")
        o.value("chacha20-poly1305", "chacha20-poly1305")
        o.rmempty = false
        o.modalonly = true

        o = ss.taboption('protocol', form.ListValue, "vmess_alter_id", _("[vmess] AlterId"), _("Deprecated. Make sure you always use VMessAEAD."))
        o.depends("protocol", "vmess")
        o.value(0, "0 (this enables VMessAEAD)")
        o.value(1, "1")
        o.value(4, "4")
        o.value(16, "16")
        o.value(64, "64")
        o.value(256, "256")
        o.rmempty = false
        o.modalonly = true

        add_flow_and_stream_security_conf(ss, "protocol", "protocol", "vmess", false, false, true)

        o = ss.taboption('protocol', form.ListValue, "vless_encryption", _("[vless] Encrypt Method"))
        o.depends("protocol", "vless")
        o.value("none", "none")
        o.rmempty = false
        o.modalonly = true

        add_flow_and_stream_security_conf(ss, "protocol", "protocol", "vless", true, true, true)

        ss.tab('transport', _('Transport Settings'));

        o = ss.taboption('transport', form.ListValue, 'transport', _('Transport'))
        o.value("tcp", "TCP")
        o.value("mkcp", "mKCP")
        o.value("ws", "WebSocket")
        o.value("h2", "HTTP/2")
        o.value("quic", "QUIC")
        o.value("grpc", "gRPC")
        o.rmempty = false

        o = ss.taboption('transport', form.ListValue, "tcp_guise", _("[tcp] Fake Header Type"))
        o.depends("transport", "tcp")
        o.value("none", _("None"))
        o.value("http", "HTTP")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.DynamicList, "http_host", _("[tcp][fake_http] Host"))
        o.depends("tcp_guise", "http")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.DynamicList, "http_path", _("[tcp][fake_http] Path"))
        o.depends("tcp_guise", "http")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.ListValue, "mkcp_guise", _("[mkcp] Fake Header Type"))
        o.depends("transport", "mkcp")
        o.value("none", _("None"))
        o.value("srtp", _("VideoCall (SRTP)"))
        o.value("utp", _("BitTorrent (uTP)"))
        o.value("wechat-video", _("WechatVideo"))
        o.value("dtls", "DTLS 1.2")
        o.value("wireguard", "WireGuard")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "mkcp_mtu", _("[mkcp] Maximum Transmission Unit"))
        o.datatype = "uinteger"
        o.depends("transport", "mkcp")
        o.default = 1350
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "mkcp_tti", _("[mkcp] Transmission Time Interval"))
        o.datatype = "uinteger"
        o.depends("transport", "mkcp")
        o.default = 50
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "mkcp_uplink_capacity", _("[mkcp] Uplink Capacity"))
        o.datatype = "uinteger"
        o.depends("transport", "mkcp")
        o.default = 5
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "mkcp_downlink_capacity", _("[mkcp] Downlink Capacity"))
        o.datatype = "uinteger"
        o.depends("transport", "mkcp")
        o.default = 20
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "mkcp_read_buffer_size", _("[mkcp] Read Buffer Size"))
        o.datatype = "uinteger"
        o.depends("transport", "mkcp")
        o.default = 2
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "mkcp_write_buffer_size", _("[mkcp] Write Buffer Size"))
        o.datatype = "uinteger"
        o.depends("transport", "mkcp")
        o.default = 2
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Flag, "mkcp_congestion", _("[mkcp] Congestion Control"))
        o.depends("transport", "mkcp")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "mkcp_seed", _("[mkcp] Seed"))
        o.depends("transport", "mkcp")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.ListValue, "quic_security", _("[quic] Security"))
        o.depends("transport", "quic")
        o.value("none", "none")
        o.value("aes-128-gcm", "aes-128-gcm")
        o.value("chacha20-poly1305", "chacha20-poly1305")
        o.rmempty = false
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "quic_key", _("[quic] Key"))
        o.depends("transport", "quic")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.ListValue, "quic_guise", _("[quic] Fake Header Type"))
        o.depends("transport", "quic")
        o.value("none", _("None"))
        o.value("srtp", _("VideoCall (SRTP)"))
        o.value("utp", _("BitTorrent (uTP)"))
        o.value("wechat-video", _("WechatVideo"))
        o.value("dtls", "DTLS 1.2")
        o.value("wireguard", "WireGuard")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.DynamicList, "h2_host", _("[http2] Host"))
        o.depends("transport", "h2")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "h2_path", _("[http2] Path"))
        o.depends("transport", "h2")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "grpc_service_name", _("[grpc] Service Name"))
        o.depends("transport", "grpc")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Flag, "grpc_multi_mode", _("[grpc] Multi Mode"))
        o.depends("transport", "grpc")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Flag, "grpc_health_check", _("[grpc] Health Check"))
        o.depends("transport", "grpc")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "grpc_idle_timeout", _("[grpc] Idle Timeout"))
        o.depends({ "transport": "grpc", "grpc_health_check": "1" })
        o.rmempty = true
        o.modalonly = true
        o.default = 10
        o.datatype = 'integer'

        o = ss.taboption('transport', form.Value, "grpc_health_check_timeout", _("[grpc] Health Check Timeout"))
        o.depends({ "transport": "grpc", "grpc_health_check": "1" })
        o.rmempty = true
        o.modalonly = true
        o.default = 20
        o.datatype = 'integer'

        o = ss.taboption('transport', form.Flag, "grpc_permit_without_stream", _("[grpc] Permit Without Stream"))
        o.depends({ "transport": "grpc", "grpc_health_check": "1" })
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "grpc_initial_windows_size", _("[grpc] Initial Windows Size"), _("Set to 524288 to avoid Cloudflare sending ENHANCE_YOUR_CALM."))
        o.depends("transport", "grpc")
        o.rmempty = true
        o.modalonly = true
        o.default = 0
        o.datatype = 'integer'

        o = ss.taboption('transport', form.Value, "ws_host", _("[websocket] Host"))
        o.depends("transport", "ws")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.Value, "ws_path", _("[websocket] Path"))
        o.depends("transport", "ws")
        o.rmempty = true
        o.modalonly = true

        o = ss.taboption('transport', form.ListValue, 'dialer_proxy', _('Dialer Proxy'), _('Similar to <a href="https://xtls.github.io/config/outbound.html#proxysettingsobject">ProxySettings.Tag</a>'))
        o.datatype = "uciname"
        o.value("disabled", _("Disabled"))
        for (const v of uci.sections(config_data, "servers")) {
            o.value(v[".name"], v.alias || v.server + ":" + v.server_port)
        }
        o.modalonly = true

        s.tab('proxy', _('Proxy Settings'));

        o = s.taboption('proxy', form.Value, 'tproxy_port_tcp', _('Transparent Proxy Port (TCP)'))
        o.datatype = 'port'
        o.default = 1080

        o = s.taboption('proxy', form.Value, 'tproxy_port_udp', _('Transparent Proxy Port (UDP)'))
        o.datatype = 'port'
        o.default = 1081

        o = s.taboption('proxy', form.Value, 'socks_port', _('Socks5 Proxy Port'))
        o.datatype = 'port'
        o.default = 1082

        o = s.taboption('proxy', form.Value, 'http_port', _('HTTP Proxy Port'))
        o.datatype = 'port'
        o.default = 1083

        if (firewall4) {
            o = s.taboption('proxy', form.DynamicList, 'uids_direct', _('Skip Proxy for uids'), _("Processes started by users with these uids won't be forwarded through Xray."))
            o.datatype = "integer"

            o = s.taboption('proxy', form.DynamicList, 'gids_direct', _('Skip Proxy for gids'), _("Processes started by users in groups with these gids won't be forwarded through Xray."))
            o.datatype = "integer"
        }

        o = s.taboption('proxy', widgets.DeviceSelect, 'lan_ifaces', _("LAN Interface"))
        o.noaliases = true
        o.rmempty = false
        o.nocreate = true

        o = s.taboption('proxy', form.SectionValue, "access_control_lan_hosts", form.TableSection, 'lan_hosts', _('LAN Hosts Access Control'), _("Will not enable transparent proxy for these MAC addresses."))

        ss = o.subsection;
        ss.sortable = false
        ss.anonymous = true
        ss.addremove = true

        o = ss.option(form.Value, "macaddr", _("MAC Address"))
        L.sortedKeys(network_hosts.hosts).forEach(function (mac) {
            o.value(mac, E([], [mac, ' (', E('strong', [network_hosts.hosts[mac].name || L.toArray(network_hosts.hosts[mac].ipaddrs || network_hosts.hosts[mac].ipv4)[0] || L.toArray(network_hosts.hosts[mac].ip6addrs || network_hosts.hosts[mac].ipv6)[0] || '?']), ')']));
        });

        o.datatype = "macaddr"
        o.rmempty = false

        o = ss.option(form.ListValue, "bypassed", _("Access Control Strategy"))
        o.value("0", "Always forwarded")
        o.value("1", "Always bypassed")
        o.rmempty = false

        s.tab('dns', _('DNS Settings'));

        o = s.taboption('dns', form.Value, 'fast_dns', _('Fast DNS'), _("DNS for resolving outbound domains and following bypassed domains"))
        o.validate = check_dns_format
        o.placeholder = "114.114.114.114"

        if (geosite_existence) {
            o = s.taboption('dns', form.DynamicList, "bypassed_domain_rules", _('Bypassed domain rules'), _('Specify rules like <code>geosite:cn</code> or <code>domain:bilibili.com</code>. See <a href="https://xtls.github.io/config/dns.html#dnsobject">documentation</a> for details.'))
        } else {
            o = s.taboption('dns', form.DynamicList, 'bypassed_domain_rules', _('Bypassed domain rules'), _('Specify rules like <code>domain:bilibili.com</code> or see <a href="https://xtls.github.io/config/dns.html#dnsobject">documentation</a> for details.<br/> In order to use Geosite rules you need a valid resource file /usr/share/jederproxy/geosite.dat.<br/>Compile your firmware again with data files to use Geosite rules, or <a href="https://github.com/v2fly/domain-list-community">download one</a> and upload it to your router.'))
        }
        o.rmempty = true

        o = s.taboption('dns', form.Value, 'secure_dns', _('Secure DNS'), _("DNS for resolving known polluted domains (specify forwarded domain rules here)"))
        o.validate = check_dns_format
        o.placeholder = "1.1.1.1"

        if (geosite_existence) {
            o = s.taboption('dns', form.DynamicList, "forwarded_domain_rules", _('Forwarded domain rules'), _('Specify rules like <code>geosite:geolocation-!cn</code> or <code>domain:youtube.com</code>. See <a href="https://xtls.github.io/config/dns.html#dnsobject">documentation</a> for details.'))
        } else {
            o = s.taboption('dns', form.DynamicList, 'forwarded_domain_rules', _('Forwarded domain rules'), _('Specify rules like <code>domain:youtube.com</code> or see <a href="https://xtls.github.io/config/dns.html#dnsobject">documentation</a> for details.<br/> In order to use Geosite rules you need a valid resource file /usr/share/jederproxy/geosite.dat.<br/>Compile your firmware again with data files to use Geosite rules, or <a href="https://github.com/v2fly/domain-list-community">download one</a> and upload it to your router.'))
        }
        o.rmempty = true

        o = s.taboption('dns', form.Value, 'default_dns', _('Default DNS'), _("DNS for resolving other sites (not in the rules above) and DNS records other than A or AAAA (TXT and MX for example)"))
        o.validate = check_dns_format
        o.placeholder = "8.8.8.8"

        if (geosite_existence) {
            o = s.taboption('dns', form.DynamicList, "blocked_domain_rules", _('Blocked domain rules'), _('Specify rules like <code>geosite:category-ads</code> or <code>domain:baidu.com</code>. See <a href="https://xtls.github.io/config/dns.html#dnsobject">documentation</a> for details.'))
        } else {
            o = s.taboption('dns', form.DynamicList, 'blocked_domain_rules', _('Blocked domain rules'), _('Specify rules like <code>domain:baidu.com</code> or see <a href="https://xtls.github.io/config/dns.html#dnsobject">documentation</a> for details.<br/> In order to use Geosite rules you need a valid resource file /usr/share/jederproxy/geosite.dat.<br/>Compile your firmware again with data files to use Geosite rules, or <a href="https://github.com/v2fly/domain-list-community">download one</a> and upload it to your router.'))
        }
        o.rmempty = true

        o = s.taboption('dns', form.Value, 'dns_port', _('Xray DNS Server Port'), _("Do not use port 53 (dnsmasq), port 5353 (mDNS) or other common ports"))
        o.datatype = 'port'
        o.default = 5300

        o = s.taboption('dns', form.Value, 'dns_count', _('Extra DNS Server Ports'), _('Listen for DNS Requests on multiple ports (all of which serves as dnsmasq upstream servers).<br/>For example if Xray DNS Server Port is 5300 and use 3 extra ports, 5300 - 5303 will be used for DNS requests.<br/>Increasing this value may help reduce the possibility of temporary DNS lookup failures.'))
        o.datatype = 'range(0, 50)'
        o.default = 0

        s.tab('transparent_proxy_rules', _('Transparent Proxy Rules'));

        if (geoip_direct_code === "upgrade" || geoip_direct_code === void 0) {
            if (geoip_existence) {
                o = s.taboption('transparent_proxy_rules', form.DynamicList, 'geoip_direct_code_list', _('GeoIP Direct Code List'), _("Hosts in these GeoIP sets will not be forwarded through Xray. Remove all items to forward all non-private hosts."))
            } else {
                o = s.taboption('transparent_proxy_rules', form.DynamicList, 'geoip_direct_code_list', _('GeoIP Direct Code List'), _("Resource file /usr/share/jederproxy/geoip.dat not exist. All network traffic will be forwarded. <br/> Compile your firmware again with data files to use this feature, or<br/><a href=\"https://github.com/v2fly/geoip\">download one</a> (maybe disable transparent proxy first) and upload it to your router."))
                o.readonly = true
            }
        } else {
            if (geoip_existence) {
                o = s.taboption('transparent_proxy_rules', form.Value, 'geoip_direct_code', _('GeoIP Direct Code'), _("Hosts in this GeoIP set will not be forwarded through Xray. <br/> Switching to new format (by selecting 'Unspecified') is recommended for multiple GeoIP options here, <br/> and is required if you want to forward all non-private hosts. This legacy option will be removed later."))
            } else {
                o = s.taboption('transparent_proxy_rules', form.Value, 'geoip_direct_code', _('GeoIP Direct Code'), _("Resource file /usr/share/jederproxy/geoip.dat not exist. All network traffic will be forwarded. <br/> Compile your firmware again with data files to use this feature, or<br/><a href=\"https://github.com/v2fly/geoip\">download one</a> (maybe disable transparent proxy first) and upload it to your router."))
                o.readonly = true
            }
        }
        o.value("cn", "cn")
        o.value("telegram", "telegram")
        o.datatype = "string"

        o = s.taboption('transparent_proxy_rules', form.ListValue, 'routing_domain_strategy', _('Routing Domain Strategy'), _("Domain resolution strategy when matching domain against rules."))
        o.value("AsIs", "AsIs")
        o.value("IPIfNonMatch", "IPIfNonMatch")
        o.value("IPOnDemand", "IPOnDemand")
        o.default = "AsIs"
        o.rmempty = false

        o = s.taboption('transparent_proxy_rules', form.Value, 'mark', _('Socket Mark Number'), _('Avoid proxy loopback problems with local (gateway) traffic'))
        o.datatype = 'range(1, 255)'
        o.default = 255

        o = s.taboption('transparent_proxy_rules', form.DynamicList, "wan_bp_ips", _("Bypassed IP"), _("Requests to these IPs won't be forwarded through Xray."))
        o.datatype = "ip4addr"
        o.rmempty = true

        o = s.taboption('transparent_proxy_rules', form.DynamicList, "wan_fw_ips", _("Forwarded IP"))
        o.datatype = "ip4addr"
        o.rmempty = true

        o = s.taboption('transparent_proxy_rules', form.SectionValue, "access_control_manual_tproxy", form.GridSection, 'manual_tproxy', _('Manual Transparent Proxy'), _('Compared to iptables REDIRECT, Xray could do NAT46 / NAT64 (for example accessing IPv6 only sites). See <a href="https://github.com/v2ray/v2ray-core/issues/2233">FakeDNS</a> for details.'))

        ss = o.subsection;
        ss.sortable = false
        ss.anonymous = true
        ss.addremove = true

        o = ss.option(form.Value, "source_addr", _("Source Address"))
        o.datatype = "ipaddr"
        o.rmempty = true

        o = ss.option(form.Value, "source_port", _("Source Port"))
        o.rmempty = true

        o = ss.option(form.Value, "dest_addr", _("Destination Address"))
        o.datatype = "host"
        o.rmempty = true

        o = ss.option(form.Value, "dest_port", _("Destination Port"))
        o.datatype = "port"
        o.rmempty = true

        o = ss.option(form.ListValue, 'domain_strategy', _('Domain Strategy'))
        o.value("UseIP")
        o.value("UseIPv4")
        o.value("UseIPv6")
        o.default = "UseIP"
        o.modalonly = true

        o = ss.option(form.Flag, 'force_forward', _('Force Forward'), _('This destination must be forwarded through an outbound server.'))
        o.modalonly = true

        o = ss.option(form.ListValue, 'force_forward_server_tcp', _('Force Forward server (TCP)'))
        o.depends("force_forward", "1")
        o.datatype = "uciname"
        for (const v of uci.sections(config_data, "servers")) {
            o.value(v[".name"], v.alias || v.server + ":" + v.server_port)
        }
        o.modalonly = true

        o = ss.option(form.ListValue, 'force_forward_server_udp', _('Force Forward server (UDP)'))
        o.depends("force_forward", "1")
        o.datatype = "uciname"
        for (const v of uci.sections(config_data, "servers")) {
            o.value(v[".name"], v.alias || v.server + ":" + v.server_port)
        }
        o.modalonly = true

        s.tab('xray_server', _('HTTPS Server'));

        o = s.taboption('xray_server', form.Flag, 'web_server_enable', _('Enable Xray HTTPS Server'), _("This will start a HTTPS server which serves both as an inbound for Xray and a reverse proxy web server."));

        o = s.taboption('xray_server', form.Value, 'web_server_port', _('Xray HTTPS Server Port'), _("This port needs to be set <code>accept input</code> manually in firewall settings."))
        o.datatype = 'port'
        o.default = 443
        o.depends("web_server_enable", "1")

        o = s.taboption('xray_server', form.FileUpload, 'web_server_cert_file', _('Certificate File'));
        o.root_directory = "/etc/luci-uploads/jederproxy"
        o.depends("web_server_enable", "1")

        o = s.taboption('xray_server', form.FileUpload, 'web_server_key_file', _('Private Key File'));
        o.root_directory = "/etc/luci-uploads/jederproxy"
        o.depends("web_server_enable", "1")

        o = s.taboption('xray_server', form.ListValue, "web_server_protocol", _("Protocol"), _("Only protocols which support fallback are available."));
        o.value("vless", "VLESS")
        o.value("trojan", "Trojan")
        o.rmempty = false
        o.depends("web_server_enable", "1")

        add_flow_and_stream_security_conf(s, "xray_server", "web_server_protocol", "vless", true, true, false)

        add_flow_and_stream_security_conf(s, "xray_server", "web_server_protocol", "trojan", true, false, false)

        o = s.taboption('xray_server', form.Value, 'web_server_password', _('UserId / Password'), _('Fill user_id for vmess / VLESS, or password for shadowsocks / trojan (also supports <a href="https://github.com/XTLS/jederproxy-core/issues/158">Xray UUID Mapping</a>)'))
        o.depends("web_server_enable", "1")

        o = s.taboption('xray_server', form.Value, 'web_server_address', _('Default Fallback HTTP Server'), _("Only HTTP/1.1 supported here. For HTTP/2 upstream, use Fallback Servers below"))
        o.datatype = 'hostport'
        o.depends("web_server_enable", "1")

        o = s.taboption('xray_server', form.SectionValue, "xray_server_fallback", form.GridSection, 'fallback', _('Fallback Servers'), _("Specify upstream servers here."))
        o.depends("web_server_enable", "1")

        ss = o.subsection;
        ss.sortable = false
        ss.anonymous = true
        ss.addremove = true

        o = ss.option(form.Value, "name", _("SNI"))
        o.rmempty = true

        o = ss.option(form.Value, "alpn", _("ALPN"))
        o.rmempty = true

        o = ss.option(form.Value, "path", _("Path"))
        o.rmempty = true

        o = ss.option(form.Value, "xver", _("Xver"))
        o.datatype = "uinteger"
        o.rmempty = true

        o = ss.option(form.Value, "dest", _("Destination Address"))
        o.datatype = 'hostport'
        o.rmempty = true

        s.tab('extra_options', _('Extra Options'))

        o = s.taboption('extra_options', form.ListValue, 'loglevel', _('Log Level'), _('Read Xray log in "System Log" or use <code>logread</code> command.'))
        o.value("debug")
        o.value("info")
        o.value("warning")
        o.value("error")
        o.value("none")
        o.default = "warning"

        o = s.taboption('extra_options', form.Flag, 'access_log', _('Enable Access Log'), _('Access log will also be written to System Log.'))

        o = s.taboption('extra_options', form.Flag, 'dns_log', _('Enable DNS Log'), _('DNS log will also be written to System Log.'))

        o = s.taboption('extra_options', form.Flag, 'xray_api', _('Enable Xray API Service'), _('Xray API Service uses port 8080 and GRPC protocol. Also callable via <code>xray api</code> or <code>ubus call xray</code>. See <a href="https://xtls.github.io/document/command.html#xray-api">here</a> for help.'))

        o = s.taboption('extra_options', form.Flag, 'stats', _('Enable Statistics'), _('Enable statistics of inbounds / outbounds data. Use Xray API to query values.'))

        o = s.taboption('extra_options', form.Flag, 'observatory', _('Enable Observatory'), _('Enable latency measurement for TCP and UDP outbounds. Support for balancers and strategy will be added later.'))

        o = s.taboption('extra_options', form.Flag, 'metrics_server_enable', _('Enable Xray Metrics Server'), _("Enable built-in metrics server for pprof and expvar. See <a href='https://github.com/XTLS/jederproxy-core/pull/1000'>here</a> for details."));

        o = s.taboption('extra_options', form.Value, 'metrics_server_port', _('Xray Metrics Server Port'), _("Metrics may be sensitive so think twice before setting it as Default Fallback HTTP Server."))
        o.depends("metrics_server_enable", "1")
        o.datatype = 'port'
        o.placeholder = '18888'

        o = s.taboption('extra_options', form.Value, 'handshake', _('Handshake Timeout'), _('Policy: Handshake timeout when connecting to upstream. See <a href="https://xtls.github.io/config/policy.html#levelpolicyobject">here</a> for help.'))
        o.datatype = 'uinteger'
        o.placeholder = 4
        o.default = 4

        o = s.taboption('extra_options', form.Value, 'conn_idle', _('Connection Idle Timeout'), _('Policy: Close connection if no data is transferred within given timeout. See <a href="https://xtls.github.io/config/policy.html#levelpolicyobject">here</a> for help.'))
        o.datatype = 'uinteger'
        o.placeholder = 300
        o.default = 300

        o = s.taboption('extra_options', form.Value, 'uplink_only', _('Uplink Only Timeout'), _('Policy: How long to wait before closing connection after server closed connection. See <a href="https://xtls.github.io/config/policy.html#levelpolicyobject">here</a> for help.'))
        o.datatype = 'uinteger'
        o.placeholder = 2
        o.default = 2

        o = s.taboption('extra_options', form.Value, 'downlink_only', _('Downlink Only Timeout'), _('Policy: How long to wait before closing connection after client closed connection. See <a href="https://xtls.github.io/config/policy.html#levelpolicyobject">here</a> for help.'))
        o.datatype = 'uinteger'
        o.placeholder = 5
        o.default = 5

        o = s.taboption('extra_options', form.Value, 'buffer_size', _('Buffer Size'), _('Policy: Internal cache size per connection. See <a href="https://xtls.github.io/config/policy.html#levelpolicyobject">here</a> for help.'))
        o.datatype = 'uinteger'
        o.placeholder = 512
        o.default = 512

        function rlimit_validate(section_id, value) {
            let rlimit_regex = new RegExp("^[0-9]+ [0-9]+$","g");
            if (value == "" || rlimit_regex.test(value)) {
                return true
            } else {
                return "rlimit format: [soft] [hard]"
            }
        }
        o = s.taboption('extra_options', form.Value, 'rlimit_nofile', _('Max Open Files'), _('Set xray process resource limit <code>RLIMIT_NOFILE</code>: max number of open file descriptors.'))
        o.value("", "[unset]")
        o.value("1024 4096", "1024 4096 (system default)")
        o.value("8192 16384")
        o.value("102400 204800")
        o.default = ""
        o.validate = rlimit_validate

        o = s.taboption('extra_options', form.Value, 'rlimit_data', _('Max Allocated Memory'), _('Set xray process resource limit <code>RLIMIT_DATA</code>: max memory usage.'))
        o.value("", "[unset]")
        o.value("52428800 52428800", "50 MiB")
        o.value("104857600 104857600", "100 MiB")
        o.value("209715200 209715200", "200 MiB")
        o.value("419430400 419430400", "400 MiB")
        o.default = ""
        o.validate = rlimit_validate

        o = s.taboption('extra_options', form.SectionValue, "xray_bridge", form.TableSection, 'bridge', _('Bridge'), _('Reverse proxy tool. Currently only client role (bridge) is supported. See <a href="https://xtls.github.io/config/reverse.html#bridgeobject">here</a> for help.'))

        ss = o.subsection;
        ss.sortable = false
        ss.anonymous = true
        ss.addremove = true

        o = ss.option(form.ListValue, "upstream", _("Upstream"))
        o.datatype = "uciname"
        for (const v of uci.sections(config_data, "servers")) {
            o.value(v[".name"], v.alias || v.server + ":" + v.server_port)
        }

        o = ss.option(form.Value, "domain", _("Domain"))
        o.rmempty = false

        o = ss.option(form.Value, "redirect", _("Redirect address"))
        o.datatype = "hostport"
        o.rmempty = false

        // if (Object.keys(optional_features).length > 0) {
        //     s.tab('optional_features', _('Optional Features'), _("Warning: all settings on this page are experimental, not guaranteed to be stable, and quite likely to be changed very frequently. Use at your own risk."))
        // }

        s.tab('custom_options', _('Custom Options'))
        o = s.taboption('custom_options', form.TextValue, 'custom_config', _('Custom Configurations'), _('Check <code>/var/etc/jederproxy/config.json</code> for tags of generated inbounds and outbounds. See <a href="https://xtls.github.io/config/features/multiple.html">here</a> for help'))
        o.monospace = true
        o.rows = 10

        o = s.taboption('custom_options', form.Value, 'custom_config_dir', _('Custom Configuration Dir'), _("Directory containing more custom configurations."))
        o.datatype = 'directory'
        o.placeholder = '/etc/jederproxy/includes'

        return m.render();
    }
});
