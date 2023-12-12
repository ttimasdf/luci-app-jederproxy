FIREWALL_INCLUDE="/usr/share/jederproxy/firewall_include.lua"

log() {
    logger -st jederproxy[$$] -p4 "$@"
}

setup_firewall() {
    log "Setting ipset rules..."
    lua /usr/share/jederproxy/gen_ipset_rules.lua | ipset -! restore

    log "Generating firewall rules..."
    /usr/bin/lua ${FIREWALL_INCLUDE} enable > $(uci get firewall.xray.path)

    log "Triggering firewall restart..."
    /etc/init.d/firewall reload
}

flush_firewall() {
    log "Flushing firewall rules..."
    /usr/bin/lua ${FIREWALL_INCLUDE} flush > $(uci get firewall.xray.path)

    log "Triggering firewall restart..."
    /etc/init.d/firewall reload

    log "Flushing ipset rules..."
    for setname in $(ipset -n list | grep "tp_spec"); do
        ipset -! destroy $setname
    done
}

impl_gen_config_file() {
    /usr/bin/lua /usr/share/jederproxy/gen_config.lua > /var/etc/jederproxy/10-config.json
}
