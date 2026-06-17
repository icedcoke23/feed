if (-not $env:DATABASE_URL) {
    Write-Error "错误: 环境变量 DATABASE_URL 未设置。请先设置数据库连接字符串后再运行此脚本。"
    Write-Host "示例: `$env:DATABASE_URL = 'postgresql://user:password@host:5432/dbname'"
    exit 1
}

Set-Location D:\AgentWork\Trae\feedback
node scripts/init-db-pg.js
