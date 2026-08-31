# ======================================================================
#  Reconfigurar Monitor - Control iD (FKG / VPoint)
#
#  Problema que este script resolve:
#  O equipamento Control iD, por algum motivo (reinicio, queda de energia,
#  atualizacao interna), as vezes PERDE a configuracao do "Monitor" que diz
#  para onde ele deve enviar os eventos de biometria. Quando isso acontece,
#  os registros de ponto simplesmente param de chegar no sistema, sem
#  nenhum aviso.
#
#  Este script fala diretamente com o equipamento via PowerShell (sem
#  passar pelo navegador), reaplicando a configuracao do Monitor. Isso
#  elimina o erro "Failed to fetch" da pagina HTML (que e um bloqueio de
#  seguranca do navegador, nao um problema real de comunicacao) e, rodado
#  de forma agendada e repetida, garante que a configuracao do equipamento
#  nunca fique "perdida" por muito tempo, mesmo se o equipamento reiniciar
#  sozinho.
#
#  Rode este script no MESMO computador onde roda a Ponte
#  (ponte-controlid.ps1), pois ele aponta o Monitor do equipamento para o
#  IP dessa Ponte.
# ======================================================================

# ---------------------- CONFIGURACOES (ajuste aqui) ----------------------

$DEVICE_IP     = "10.242.20.252"        # IP do equipamento Control iD na rede local
$DEVICE_PORT   = "8080"                 # Porta web do equipamento
$DEVICE_USER   = "admin"                # Usuario administrador do equipamento
$DEVICE_PASS   = 'F$k@G$202$'           # Senha administrador do equipamento

$BRIDGE_IP     = "10.242.10.18"         # IP do computador onde a Ponte (ponte-controlid.ps1) esta rodando
$BRIDGE_PORT   = "3939"                 # Porta da Ponte (fixa, nao muda)
$WEBHOOK_PATH  = "api/controlid/webhook/cf0a16ea07b9fd0526c9a2adb8597e0fa"  # Caminho do webhook (copiado de Configuracoes -> Integracao Biometria)

$LOG_FILE      = Join-Path $PSScriptRoot "reconfigurar-monitor-log.txt"
$LOG_MAX_BYTES = 2MB

# ---------------------------------------------------------------------

function Write-Log {
    param([string]$Message, [string]$Color = "Gray")
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    try { Write-Host $line -ForegroundColor $Color } catch {}
    try {
        if ((Test-Path $LOG_FILE) -and ((Get-Item $LOG_FILE).Length -gt $LOG_MAX_BYTES)) {
            $old = Join-Path $PSScriptRoot "reconfigurar-monitor-log.old.txt"
            Move-Item -Path $LOG_FILE -Destination $old -Force -ErrorAction SilentlyContinue
        }
        Add-Content -Path $LOG_FILE -Value $line -Encoding UTF8
    } catch {}
}

Write-Log "===== Verificando/reaplicando configuracao do Monitor =====" "Cyan"

# O servidor web do equipamento Control iD nao suporta o cabecalho
# "Expect: 100-continue" que o PowerShell manda por padrao em requisicoes
# POST, e responde com erro 417 (Expectation Failed). Desligando isso aqui
# evita esse erro.
[System.Net.ServicePointManager]::Expect100Continue = $false

try {
    # Passo 1: login no equipamento
    $loginUrl = "http://${DEVICE_IP}:${DEVICE_PORT}/login.fcgi"
    $loginBody = @{ login = $DEVICE_USER; password = $DEVICE_PASS } | ConvertTo-Json

    $loginResp = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $loginBody -ContentType "application/json" -TimeoutSec 10

    if (-not $loginResp.session) {
        Write-Log "ERRO: login no equipamento falhou. Resposta: $($loginResp | ConvertTo-Json -Compress)" "Red"
        exit 1
    }

    $session = $loginResp.session
    Write-Log "Login OK no equipamento. Sessao obtida." "Green"

    # Passo 2: reaplicar a configuracao do Monitor
    $configUrl = "http://${DEVICE_IP}:${DEVICE_PORT}/set_configuration.fcgi?session=$session"
    $configBody = @{
        monitor = @{
            request_timeout = "5000"
            hostname        = $BRIDGE_IP
            port            = $BRIDGE_PORT
            path            = $WEBHOOK_PATH
        }
    } | ConvertTo-Json

    $configResp = Invoke-RestMethod -Uri $configUrl -Method POST -Body $configBody -ContentType "application/json" -TimeoutSec 10

    Write-Log "Configuracao do Monitor reaplicada. Resposta: $($configResp | ConvertTo-Json -Compress)" "Green"
    Write-Log "===== Concluido com sucesso =====" "Cyan"
    exit 0

} catch {
    Write-Log "ERRO ao falar com o equipamento: $($_.Exception.Message)" "Red"
    Write-Log "Isso pode ser rede fora do ar, equipamento desligado/reiniciando, ou IP/porta incorretos." "Yellow"
    exit 1
}
