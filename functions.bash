# --- alleycat-bash v0.5.0

# --- hush all 'info' statements
_acat_quiet_info=no
# --- hush all non-warn & non-error output (including info statements)
_acat_quiet_say=no
# --- hush `cmd`
_acat_quiet_cmd=no
# --- hush `fun`
_acat_quiet_fun=no

_acat_stack_path=()
_acat_ret0=

# --- will be created during stack-pop / stack-push.

# _acat_varstack_xxx=()
# _acat_varstack_yyy=()

_acat_checkbash () {
    if [ -z "${BASH_VERSION:-}" ]; then
        echo 'functions.bash requires bash >= 4.4'
        exit 1
    fi

    local maj=$(echo "$BASH_VERSION" | cut -b 1-1)
    local min=$(echo "$BASH_VERSION" | cut -b 3-3)

    if [ "$maj" -lt 4 ]; then
        echo 'functions.bash requires bash >= 4.4'
        exit 1
    elif [ "$maj" -eq 4 ]; then
        if [ "$min" -lt 4 ]; then
            echo 'functions.bash requires bash >= 4.4'
            exit 1
        fi
    fi
}; _acat_checkbash

eval-it () {
    local e
    printf -v e "$@"
    eval "$e"
}

quiet-say () {
    _acat_quiet_say=yes
}

noisy-say () {
    _acat_quiet_say=no
}

quiet-info () {
    _acat_quiet_info=yes
}

noisy-info () {
    _acat_quiet_info=no
}

quiet-all () {
    quiet-cmd
    quiet-fun
    quiet-info
    quiet-say
}

noisy-all () {
    noisy-cmd
    noisy-fun
    noisy-info
    noisy-say
}

quiet-cmd () {
    _acat_quiet_cmd=yes
}

noisy-cmd () {
    _acat_quiet_cmd=no
}

quiet-fun () {
    _acat_quiet_fun=yes
}

noisy-fun () {
    _acat_quiet_fun=no
}

_quiet-all () {
    local x
    if [ "$1" = yes ]; then x=quiet
    elif [ "$1" = no ]; then x=noisy
    else return 1
    fi

    local i
    for i in say info cmd fun; do
        eval "$x"-"$i"
    done
}

quiet-all () {
    _quiet-all yes
}

noisy-all () {
    _quiet-all no
}

bullet () {
    echo ٭
}

beep () {
    echo ""
}

color () {
    local c="$1"; shift

    local doit=no

    if [ -t 0 -o -n "${force_colors:-}" ]; then
        doit=yes
    fi

    # --- difficult to make it work right for printf.
    if [ "$doit" = yes ]; then
        echo -n [${c}m"${@}"[0m
    else
        echo -n "$@"
    fi
}

bold () {
    color 1 "$@"
}
underline () {
    color 4 "$@"
}
reversed () {
    color 7 "$@"
}
green () {
    color 32 "$@"
}
bright-green () {
    color 92 "$@"
}
yellow () {
    color 33 "$@"
}
bright-yellow () {
    color 93 "$@"
}
red () {
    color 31 "$@"
}
bright-red () {
    color 91 "$@"
}
blue () {
    color 34 "$@"
}
bright-blue () {
    color 94 "$@"
}
magenta () {
    color 35 "$@"
}
bright-magenta () {
    color 95 "$@"
}
cyan () {
    color 36 "$@"
}
bright-cyan () {
    color 96 "$@"
}

doit () {
    echo "$@"
    "$@"
}

shell-quote () {
    for i in "$@"; do
        # --- ] has to be the first thing in the list.
        if [[ "$i" =~ [][:space:]\;\$\!\&\*\(\)\{\[\}\<\>\?\~\`\'\"] ]] ; then
            # --- if it contains a special char or a space, do the quoting.
            #
            # simple algorithm: substitute every single quote with single
            # quote + backslash + single quote + single quote, then surround
            # the entire thing with single quotes.
            #
            # regex preceded by / to mean global.
            #
            # (yes really).
            printf -- "%s%s%s" \' "${i//\'/\'\\\'\'}"  \'
        else
            printf -- "%s" "$i"
        fi
    done
}

# --- @todo: it's impossible to print the string '-n' like this, which gets
# silently eaten by echo. Need 'ac-echo', which prints a literal -n if
# necessary and passes through to echo otherwise.
shell-quote-each () {
    local q=()
    local i
    for i in "$@"; do
        q+=("$(shell-quote "$i")")
    done
    echo -n "${q[@]}"
}

fun-print () {
    if [ "$_acat_quiet_fun" = yes ]; then
        return 0
    fi
    local b
    b=$(green "$(bullet)")
    local first="$1"; shift
    sayf "$b %s (%s)" "$(bright-red "$(shell-quote "$first")")" "$(shell-quote-each "$@")"
}

cmd-print () {
    if [ "$_acat_quiet_cmd" = yes ]; then
        return 0
    fi
    local b
    b=$(green "$(bullet)")
    local first="$1"; shift
    sayf "$b %s %s" "$(cyan "$(shell-quote "$first")")" "$(shell-quote-each "$@")"
}

fun () {
    fun-print "$@"
    "$@"
}

cmd () {
    cmd-print "$@"
    "$@"
}

cmd-capture () {
    local ret=$1; shift
    cmd-print "$@"
    # --- capture mode means turn off output.
    local save="$_acat_quiet_cmd"
    _acat_quiet_cmd=yes
    res=$("$@")
    # --- @todo use save
    _acat_quiet_cmd=no
    rc=$?
    read -d '' "$ret" <<< "$res" || true
    return "$rc"
}

cmd-source () {
    info "$(printf "[ %s ] %s" "$(yellow source)" "$@" )"
    . "$@"
}

cmd_eval () {
    green "$(bullet) "
    echo "$@"
    eval "$@"
}

say () {
    if [ "$_acat_quiet_say" = yes ]; then
        return
    fi
    echo "$@"
}

sayf () {
    local e
    printf -v e "$@"
    say "$e"
}

info () {
    if [ "$_acat_quiet_info" = yes ]; then
        return
    fi
    local b
    b=$(bright-blue "$(bullet)")
    if [ "$1" = '-n' ]; then
        shift
        say -n "$b $@"
    else
        say "$b $@"
    fi
}

error () {
    printf >&2 "%s Error: %s\n" $(red "$(bullet)") "$*"
    exit 1
}

warn () {
    printf >&2 "%s %s\n" $(bright-red "$(bullet)") "$*"
}

infof () {
    local one="$1"; shift
    local e
    printf -v e "$one" "$@"
    info "$e"
}

errorf () {
    local one="$1"; shift
    local e
    printf -v e "$one" "$@"
    error "$e"
}

warnf () {
    local one="$1"; shift
    local e
    printf -v e "$one" "$@"
    warn "$e"
}

press_enter () {
    perl -e "print 'Press enter to continue. '; <STDIN>"
}

shout () {
    "$@" >/dev/null
}

sherr () {
    "$@" 2>/dev/null
}

quiet () {
    shout sherr "$@"
}

redirect-in () {
    local file=$1; shift
    "$@" < "$file"
}

redirect-in-val () {
    local val=$1; shift
    echo "$val" | "$@"
}

# --- like pipe with head / tail reversed.
redirect-in-cmd () {
    local cmd=$1; shift
    "$cmd" | "$@"
}

redirect-out () {
    local file=$1; shift
    "$@" > "$file"
}

redirect-out-delay () {
    local file=$1; shift
    local out
    out=$($@)
    if [ ! "$?" = 0 ]; then return; fi
    echo "$out" > "$file"
}

redirect-out-append () {
    local file=$1; shift
    "$@" >> "$file"
}

redirect-err () {
    local file=$1; shift
    "$@" 2> "$file"
}

redirect-err-append () {
    local file=$1; shift
    "$@" 2>> "$file"
}

redirect-out-and-err () {
    local file=$1; shift
    "$@" > "$file" 2>&1
}

redirect-out-and-err-append () {
    local file=$1; shift
    "$@" >> "$file" 2>&1
}

redirect-err-to-out () {
    "$@" 2>&1
}

# --- usage: wait-while-pids-alive pid1 pid2 ...
wait-while-pids-alive () {
    local pid
    for pid in "$@"; do
        while quiet ps "$pid"; do
            info $(printf "Waiting for %s to die.\n" $(yellow "$pid"))
            sleep 1
        done
    done
}

# --- usage: wait-while-pid-alive pid [cmd ...]
wait-while-pid-alive () {
    local pid=$1; shift
    while quiet ps "$pid"; do
        info $(printf "Waiting for %s to die.\n" $(yellow "$pid"))
        sleep 1
    done
    if [ ! "$#" = 0 ]; then
        cmd "$@"
    fi
}

# --- dies.
chd () {
    local dir="$1"; shift
    if [ ! -e "$dir" ]; then
        warnf "Dir %s doesn't exist" "$(red "$dir")"
        return 1
    fi
    redirect-out /dev/null pushd "$dir"
    infof "[ %s ] %s" "$(yellow 'chdir')" "$dir"
    if [ $? != 0 ]; then
        warnf "Couldn't cd to dir %s" "$(red "$dir")"
        return 1
    fi

    if [ "$@" ]; then
        cmd "$@"
        popd
    fi
}

cpa () {
    cmd cp -a "$@"
}

mkd () {
    local dir="$1"
    infof "[ %s ] %s" "$(green 'mkdir')" "$dir"
    mkdir -p "$dir"
}

# --- dies.
mkchd () {
    local dir="$1"
    mkd "$dir"
    chd "$dir"
}

# --- dies.
chd-back () {
    chd-back-n 1
}

# --- dies.
# --- assume n non-negative.
chd-back-n () {
    local n="$1"
    local dir
    dir=$(dirs +$n)
    infof "[ %s %s ] %s" "$(yellow 'chdir-back')" "$(bright-red "$n")" "$dir"
    local i=0
    while [ $i -lt $n ]; do
        let i=i+1
        redirect-out /dev/null popd
    done
}

# --- usage: e.g. cwd .. command
# --- dies if unable to cd; otherwise returns exit val of call.
cwd () {
    local dir="$1"; shift
    if ! chd "$dir"; then
        return $?
    fi
    "$@"
    local ret=$?
    quiet popd
    if [ "$ret" = 0 ]; then true
    else false; fi
}

pipe-print () {
    local n=$1; shift
    local printpipes=()
    local printrest=()
    local numargs=$#
    local x
    local i=0
    while [ "$i" -lt "$numargs" ]; do
        x=$1; shift
        if [ "$i" -lt "$n" ]; then
            printpipes=("| $(green "$x")" "${printpipes[@]}")
        else printrest+=("$x"); fi
        let i=i+1
    done
    sayf "%s [ %s ] %s %s" "$(green "$(bullet)")" "$(yellow pipe)" "${printrest[*]}" "${printpipes[*]}"
}

# --- @todo a version which uses |&, i.e. pipe out & err.
_pipe-n () {
    local quiet=$1; shift

    local savequiet
    local n=$1; shift

    if [ ! "$quiet" = yes ]; then pipe-print "$@"; fi

    local firstpipe
    local restpipes=()
    local ret
    local x
    local i=0
    local rc
    while [ "$i" -lt "$n" ]; do
        x=$1; shift
        if [ "$i" = $(("$n"-1)) ]; then firstpipe=$x
        else restpipes=("$x" "${restpipes[@]}"); fi
        let i=i+1
    done
    # --- @todo add -o pipefail at the top of the script.
    set +o pipefail
    ret=$("$@" | "$firstpipe")
    rc=$?
    if [ ! "$rc" = 0 ]; then
        echo "$ret"
        return "$c"
    fi
    set -o pipefail
    local pip
    for pip in "${restpipes[@]}"; do
        set +o pipefail
        ret=$(echo "$ret" | "$pip")
        rc=$?
        if [ ! "$rc" = 0 ]; then
            echo "$ret"
            return "$rc"
        fi
        set -o pipefail
    done
    echo "$ret"
}

# --- @todo turn off noisy cmds
pipe-n () {
    _pipe-n no "$@"
}

pipe-n-capture () {
    local ret=$1; shift
    local res
    res=$(_pipe-n yes "$@")
    read -d '' "$ret" <<< "$res" || true
}

pipe-print () {
    local rt="$1"; shift
    sayf "%s [ %s ] %s | %s" "$(green "$(bullet)")" "$(yellow pipe)" "$*" "$(green "$rt")"
}

# --- quiet param is handled differently than in cmd/cmd-capture. xxx
_pipe () {
    local quiet=$1; shift
    local rt="$1"; shift
    local save="$_acat_quiet_cmd"
    if [ "$quiet" = yes ]; then
        _acat_quiet_cmd=yes
    else
        pipe-print "$rt" "$@"
    fi
    "$@" | "$rt"
    _acat_quiet_cmd=$save
}

pipe-capture () {
    local ret=$1; shift
    local res
    pipe-print "$@"
    res=$(_pipe yes "$@")
    retvar "$ret" "$res"
}

pipe () {
    _pipe no "$@"
}

forkit () {
    sayf "%s [ %s ] %s" "$(green "$(bullet)")" "$(yellow fork)" "$(shell-quote-each "$@")"
    "$@" &
    info "         $(printf "pid = %s" "$(yellow $!)")"
}

# --- assembles its arguments by joining on /.
# --- croaks if:
# - any of the arguments is empty,
# - the first argument begins with a slash (override using `allow_absolute`)
# - the resulting string exists but is not a dir.
# - the resulting string is '/'
# --- as an exception you can use '.' as the final element to allow an
# absolute path.
# --- no-op if the final string doesn't exist.

_safe-rm-dir () {
    local allow_absolute=no
    allow_absolute="$1"
    shift

    local dir=''
    local refuse=no
    local reason=
    local i
    local first=yes

    for i in "$@"; do
        if [ "$i" = "" ]; then
            refuse=yes
            reason="path element empty"
        fi
        if [ "$first" = yes ]; then
            first=no
            dir="$i"
        else
            dir="$dir/$i"
        fi
    done

    if [ "$refuse" = no ]; then
        if [[ "$allow_absolute" != yes && "$dir" =~ ^/ ]]; then
            refuse=yes
            reason="path is absolute"
        elif [ ! -e "$dir" ]; then
            # --- no message, no-op.
            return 0
        elif [ ! -d "$dir" ]; then
            refuse=yes
            reason="not a dir"
        elif [ "$dir" = / ]; then
            refuse=yes
            reason="won't trash /"
        fi
    fi
    if [ "$refuse" = yes ]; then
        error "$(printf "Refusing to remove %s (%s)" $(bright-red "$dir") "$reason")"
    fi
    cmd rm -rf "$dir"
}

safe-rm-dir () {
    _safe-rm-dir yes "$@"
}

safe-rm-dir-no-absolute () {
    _safe-rm-dir no "$@"
}

# --- deprecated.
safe-rm-dir-allow-absolute () {
    warn "safe-rm-dir-allow-absolute is deprecated; use safe-rm-dir instead."
    _safe-rm-dir yes "$@"
}

safe-rm-dir-array () {
    local aryname=$1
    eval-it '_safe-rm-dir yes ${%s[@]}' "$aryname"
}

safe-rm-dir-array-no-absolute () {
    local aryname=$1
    eval-it '_safe-rm-dir no ${%s[@]}' "$aryname"
}

safe-rm-dir-array-allow-absolute () {
    warn "safe-rm-dir-array-allow-absolute is deprecated; use safe-rm-dir-array instead."

    local aryname=$1
    eval-it '_safe-rm-dir yes ${%s[@]}' "$aryname"
}

# --- usage: join retvar aryvar joinchar
join () {
    local ret="$1"
    local var="$2"
    local joiner="$3"
    local joined=''
    local i=0
    local len
    eval "len=\${#${var}[@]}"
    local len1
    let len1=len-1 || true
    local val
    while [ "$i" -lt "$len1" ]; do
        eval "val=\${${var}[$i]}"
        joined+="$val$joiner"
        let i=i+1
    done
    if [ "$len1" -ge 0 ]; then
        eval "val=\${${var}[$len1]}"
        joined+="$val"
    fi
    read -d '' "$ret" <<< "$joined" || true
}

# --- like join, but prints to stdout instead of taking a retvar.
# --- also, param order switched.
# --- @todo is join still useful?
join-out () {
    local joiner=$1
    local var=$2
    join _ret0 "$var" "$joiner"
    echo "$_ret0"
}

# --- local set (like xport but don't export).

assign () {
    local var="$1"
    local val="$2"

    info "$(printf "[ %s ] %s %s" "$(yellow assign)" "$(bright-red "$var")" "$val" )"
    # xxx check delim; empty val
    read $var <<< "$val"
}

# --- usage:
# myvar=(a b c)
# xport-array myvar

xport-array () {
    local var="$1"
    echo fjdsf
    echo "$var"
    join _acat_ret0 "$var" "$(echo -e " \n ")"
    local joined="$_acat_ret0"
    # --- join xxx
    info "$(printf "[ %s ] %s %s" "$(yellow env-array)" "$(bright-red "$var")" "$(echo -e "\n ")$joined" )"
    export "$var"
}

xport () {
    local var="$1"
    local val="${2:-}"
    local localvar

    sayf "$(printf "[ %s ] %s %s" "$(yellow env)" "$(bright-red "$var")" "$val" )"
    read -d '' localvar <<< "$val" || true
    export "$var"="$localvar"
}

_xport-prepend () {
    local sep=$1
    local var=$2
    local val=$3
    sayf "$(printf "[ %s ] %s %s" "$(yellow env-prepend)" "$(bright-red "$var")" "$val" )"
    local cur=$(eval "echo \$$var")
    local concat="$val$sep$cur"
    xport "$var" "$concat"
}

xport-prepend () {
    _xport-prepend : "$@"
}

xport-prepend-space () {
    _xport-prepend ' ' "$@"
}

_xport-append () {
    local sep=$1
    local var=$2
    local val=$3
    sayf "$(printf "[ %s ] %s %s" "$(yellow env-append)" "$(bright-red "$var")" "$val" )"
    local cur=$(eval "echo \$$var")
    local concat="$cur$sep$val"
    xport "$var" "$concat"
}

xport-append-space () {
    _xport-append ' ' "$@"
}

xport-append () {
    _xport-append : "$@"
}

# ------ short-circuit on emptiness.
doublebar () {
    if [ -n "$1" ]; then echo "$1"; else echo "$2"; fi
}
ternary () {
    if [ -n "$1" ]; then echo "$2"; else echo "$3"; fi
}

multiline-cmd-init () {
    __multiline_init=yes
    __multiline=()
}

multiline-cmd-build () {
    if [ ! "$__multiline_init" = yes ]; then
        error "must call multiline-cmd-init before multiline-cmd-build"
    fi
    __multiline+=("$@")
}

multiline-cmd-go () {
    local failed=
    cmd "${__multiline[@]}" || failed=1
    __multiline_init=no
    if [ "$failed" = 1 ]; then return 1; fi
}

mcg () {
    multiline-cmd-go "$@"
}

mci () {
    multiline-cmd-init "$@"
}

mcb () {
    multiline-cmd-build "$@"
}

# --- example usage of retvar:
#
# count-words () {
#      local ret="$1"; shift
#      local cnt
#      cnt=$(wc -w <<< "$@")
#      retvar "$ret" "$cnt"
# }
#
# count-words _ret0 'some string'
# # or cmd count-words _ret0 'some string'
# cnt="$_ret0" # => 2
#
# • read eliminates the need for eval
# • to read the entire string (and not break on newlines), we need -d ''
# • … which results in a non-successful exit, hence || true

retvar () {
    local ret="$1"; shift
    read -d '' "$ret" <<< "$@" || true
}

also () {
    local then
    then="$1"; shift
    "$@" && "$then"
}

unless () {
    local then
    then="$1"; shift
    "$@" || "$then"
}

_acat_varstack_name () {
    echo "_acat_varstack_$1"
}

# @todo add with-env

stack-push () {
    local varname=$1; shift
    local curval

    sayf "[ %s ] %s" "$(cyan stack-push)" "$(bright-red "$varname")"
    local v
    printf -v v '${%s:-}' "$varname"
    eval-it "read -d '' curval <<< \"%s\" || true" "$v"
    local stackvarname
    stackvarname=$(_acat_varstack_name "$varname")
    # --- springs into existence, ok.
    eval-it '%s+=("%s")' "$stackvarname" "$curval"
}

stack-pop () {
    local varname=$1; shift
    local i=0
    local len
    local s
    local stackvarname
    stackvarname=$(_acat_varstack_name "$varname")
    eval-it 'len=${#%s[@]}' "$stackvarname"
    if [ "$len" = 0 ]; then
        printf -v s "$(bright-red "$varname")"
        error "stack-pop: stack for $s is empty"
    fi
    local len1=$(("$len" - 1))
    local new=()
    while [ "$i" -lt "$len1" ]; do
        eval-it 'new+=("${%s[$i]}")' "$stackvarname"
        let i=i+1
    done
    sayf "[ %s ] %s" "$(green stack-pop)" "$(bright-red "$varname")"
    eval-it 'xport "%s" ${%s["$len1"]}' "$varname" "$stackvarname"
    eval-it '%s=("${new[@]}")' "$stackvarname"
}

stack-push-xport () {
    stack-push "$1"
    xport "$1" "$2"
}

# stack-push-xport-path () {
#    stack-push PATH
#    xport PATH "$1"
# }

stack-push-path () {
    stack-push PATH
}

stack-pop-path () {
    stack-pop PATH
}
