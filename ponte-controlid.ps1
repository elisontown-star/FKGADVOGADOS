# ======================================================================
#  Ponte HTTP -> HTTPS para o equipamento Control iD
#  FKG Advogados / Sistema de Presenca (VPoint)
#
#  O equipamento Control iD so envia eventos via HTTP puro (sem HTTPS).
#  Este script escuta essas requisicoes localmente na rede e repassa
#  para o sistema na nuvem via HTTPS.
#
#  VERSAO 2: preparado para rodar sozinho, sem janela aberta, via
#  Tarefa Agendada do Windows (Task Scheduler). Grava tudo em um
#  arquivo de log (ponte-log.txt, na mesma pasta deste script), entao
#  mesmo rodando escondido da pra conferir se esta funcionando.
#
#  Se voce ainda quiser rodar manualmente (janela aberta), funciona
#  igual a antes - so nao vai fechar sozinho, o log aparece na tela
#  E no arquivo.
# ======================================================================

$PORT_LOCAL = 3939
$DESTINO_BASE = "https://fkg-presenca.pages.dev"   # ajuste se o dominio mudar
$LOG_FILE = Join-Path $PSScriptRoot "ponte-log.txt"
$LOG_MAX_BYTES = 2MB

function Write-Log {
    param(
        [string]$Message,
        [string]$Color = "Gray"
    )
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    try { Write-Host $line -ForegroundColor $Color } catch {}
    try {
        if ((Test-Path $LOG_FILE) -and ((Get-Item $LOG_FILE).Length -gt $LOG_MAX_BYTES)) {
            $old = Join-Path $PSScriptRoot "ponte-log.old.txt"
            Move-Item -Path $LOG_FILE -Destination $old -Force -ErrorAction SilentlyContinue
        }
        Add-Content -Path $LOG_FILE -Value $line -Encoding UTF8
    } catch {}
}

Write-Log "===== Ponte iniciando =====" "Cyan"

# Tenta liberar a porta no firewall do Windows (precisa ser Administrador)
try {
    $existingRule = Get-NetFirewallRule -DisplayName "ControlID Bridge" -ErrorAction SilentlyContinue
    if (-not $existingRule) {
        New-NetFirewallRule -DisplayName "ControlID Bridge" -Direction Inbound -Protocol TCP -LocalPort $PORT_LOCAL -Action Allow | Out-Null
        Write-Log "Regra de firewall criada para a porta $PORT_LOCAL." "Green"
    }
} catch {
    Write-Log "Aviso: nao foi possivel criar a regra de firewall automaticamente. Se necessario, rode como Administrador ou libere a porta $PORT_LOCAL manualmente." "Yellow"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$PORT_LOCAL/")

try {
    $listener.Start()
} catch {
    Write-Log "ERRO FATAL ao iniciar na porta $PORT_LOCAL : $($_.Exception.Message)" "Red"
    Write-Log "Isso costuma acontecer se ja existe outra copia da ponte rodando, ou se falta permissao de Administrador." "Red"
    exit 1
}

Write-Log "================================================="  "Cyan"
Write-Log "Ponte Control iD ativa na porta $PORT_LOCAL"        "Cyan"
Write-Log "Encaminhando para: $DESTINO_BASE"                   "Cyan"
Write-Log "================================================="  "Cyan"

try {
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response

            $path = $request.Url.PathAndQuery
            $body = ""
            if ($request.HasEntityBody) {
                $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                $body = $reader.ReadToEnd()
                $reader.Close()
            }

            try {
                $targetUrl = $DESTINO_BASE + $path
                Invoke-RestMethod -Uri $targetUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 8 | Out-Null
                Write-Log "OK   -> $path" "Green"
            } catch {
                Write-Log "ERRO ao encaminhar $path : $($_.Exception.Message)" "Red"
            }

            $buffer = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
            $response.ContentType = "application/json"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
        } catch {
            # Erro ao processar UMA requisicao especifica - loga e continua escutando,
            # nao derruba a ponte inteira por causa de uma requisicao problematica.
            Write-Log "ERRO ao processar requisicao: $($_.Exception.Message)" "Red"
        }
    }
    Write-Log "Listener parou de escutar (IsListening = false). Encerrando para permitir reinicio automatico." "Yellow"
    exit 1
} catch {
    # Erro inesperado que derrubou o loop principal inteiro.
    Write-Log "ERRO FATAL inesperado: $($_.Exception.Message)" "Red"
    exit 1
}
