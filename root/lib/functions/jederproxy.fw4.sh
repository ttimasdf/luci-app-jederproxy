FIREWALL_INCLUDE="/usr/share/jederproxy/firewall_include.ut"

log() {
    logger -st jederproxy[$$] -p4 "$@"
}

setup_firewall() {
    ip route add local default dev lo table 100
    ip rule  add fwmark 0x2333        table 100

    log "Generating firewall4 rules..."
    /usr/bin/utpl ${FIREWALL_INCLUDE} > /var/etc/jederproxy/firewall_include.nft

    log "Triggering firewall4 restart..."
    /etc/init.d/firewall restart > /dev/null 2>&1
}

flush_firewall() {
    ip rule  del   table 100
    ip route flush table 100

    log "Flushing firewall4 rules..."
    rm /var/etc/jederproxy/firewall_include.nft 2>/dev/null || log ".. but fw4 rule file not exists"

    log "Triggering firewall4 restart..."
    /etc/init.d/firewall restart > /dev/null 2>&1
}

impl_gen_config_file() {
    /usr/bin/ucode /usr/share/jederproxy/gen_config.uc > /var/etc/jederproxy/10-config.json
}
