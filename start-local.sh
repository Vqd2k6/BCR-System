#!/usr/bin/env bash
# ==============================================================================
# HỆ THỐNG KHẢO SÁT QUY HOẠCH HIỆN TRẠNG CÔNG TRÌNH METRO 2 (BẾN THÀNH - THAM LƯƠNG)
# SCRIPT KHỞI ĐỘNG LOCAL DUY NHẤT (ALL-IN-ONE LOCAL RUNNER)
# ==============================================================================

# Định vị thư mục gốc dự án
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Màu sắc hiển thị terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}${BOLD}====================================================================${NC}"
echo -e "${GREEN}${BOLD} 🚇 METRO 2 BUILDING CONDITION SURVEY - KHỞI ĐỘNG TOÀN BỘ HỆ THỐNG  ${NC}"
echo -e "${CYAN}${BOLD}====================================================================${NC}"
echo ""

# 1. Kiểm tra Docker
echo -e "${BLUE}▶ [1/4] Kiểm tra dịch vụ CSDL PostgreSQL 16 + PostGIS...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ LỖI: Không tìm thấy lệnh 'docker'. Vui lòng cài đặt Docker Desktop!${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ LỖI: Docker daemon chưa chạy. Vui lòng mở ứng dụng Docker Desktop rồi chạy lại!${NC}"
    exit 1
fi

# Chạy container database PostGIS
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}❌ LỖI: Không tìm thấy docker compose!${NC}"
    exit 1
fi

$DOCKER_COMPOSE_CMD up -d postgres_postgis > /dev/null 2>&1
echo -e "${GREEN}✔ Container CSDL 'metro2_postgres_postgis' đang chạy trên cổng 5433.${NC}"

# Chờ CSDL sẵn sàng
echo -n -e "${BLUE}▶ Đang kiểm tra kết nối PostGIS... ${NC}"
MAX_WAIT=20
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    DB_STATUS=$(docker inspect -f '{{.State.Health.Status}}' metro2_postgres_postgis 2>/dev/null)
    if [ "$DB_STATUS" = "healthy" ]; then
        echo -e "${GREEN}Sẵn sàng!${NC}"
        break
    fi
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
    echo -n "."
done

if [ "$DB_STATUS" != "healthy" ]; then
    echo -e "${YELLOW} (Chờ tối đa vượt ngưỡng, tiếp tục khởi chạy...)${NC}"
fi

# 2. Kiểm tra node_modules
echo -e "${BLUE}▶ [2/4] Kiểm tra thư viện npm cho Backend và Frontend...${NC}"
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}⚡ backend/node_modules chưa có. Đang cài đặt thư viện backend...${NC}"
    (cd backend && npm install)
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}⚡ frontend/node_modules chưa có. Đang cài đặt thư viện frontend...${NC}"
    (cd frontend && npm install)
fi
echo -e "${GREEN}✔ Các thư viện đã được cài đặt đầy đủ.${NC}"

# 3. Dọn dẹp cổng kẹt (port 4000, 3000) nếu có tiến trình treo cũ
echo -e "${BLUE}▶ [3/4] Kiểm tra và giải phóng cổng mạng...${NC}"
for PORT in 4000 3000; do
    PID=$(lsof -ti :$PORT 2>/dev/null)
    if [ -n "$PID" ]; then
        echo -e "${YELLOW}⚠ Giải phóng cổng $PORT (kill PID $PID)...${NC}"
        kill -9 $PID 2>/dev/null || true
    fi
done
echo -e "${GREEN}✔ Cổng 4000 (Backend API) và cổng 3000 (Frontend PWA) đã sẵn sàng.${NC}"

# 4. Khởi chạy Backend và Frontend song song
echo -e "${BLUE}▶ [4/4] Khởi động đồng thời Backend API và Frontend Vite...${NC}"

# Quản lý dọn dẹp khi bấm Ctrl+C
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo -e "${YELLOW}${BOLD}🛑 Đang dừng toàn bộ dịch vụ...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    # Quét thêm để diệt các child process của vite/ts-node-dev
    for PORT in 4000 3000; do
        PID=$(lsof -ti :$PORT 2>/dev/null)
        if [ -n "$PID" ]; then
            kill -9 $PID 2>/dev/null || true
        fi
    done
    echo -e "${GREEN}✔ Đã tắt hoàn tất. Cảm ơn bạn đã sử dụng hệ thống!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Khởi động Backend
(cd backend && npm run dev) &
BACKEND_PID=$!

# Khởi động Frontend
(cd frontend && npm run dev) &
FRONTEND_PID=$!

# Chờ 3 giây để in bảng thông tin
sleep 3

echo ""
echo -e "${GREEN}${BOLD}====================================================================${NC}"
echo -e "${GREEN}${BOLD} ✨ HỆ THỐNG ĐÃ SẴN SÀNG HOẠT ĐỘNG!                                  ${NC}"
echo -e "${GREEN}${BOLD}====================================================================${NC}"
echo -e "${CYAN}${BOLD}🌐 Ứng dụng Frontend (PWA) :${NC} ${YELLOW}${BOLD}http://localhost:3000${NC}"
echo -e "${CYAN}${BOLD}🔌 API Backend Service     :${NC} ${YELLOW}http://localhost:4000/api/v1${NC}"
echo -e "${CYAN}${BOLD}🩺 Kiểm tra Health check   :${NC} ${YELLOW}http://localhost:4000/health${NC}"
echo -e "${CYAN}${BOLD}🗄️ CSDL PostgreSQL + PostGIS:${NC} ${YELLOW}localhost:5433 (metro2_gis_db)${NC}"
echo ""
echo -e "${CYAN}${BOLD}🔑 TÀI KHOẢN ĐĂNG NHẬP MẪU:${NC}"
echo -e "   • ${BOLD}Super Admin :${NC} username: ${GREEN}superadmin${NC}     | password: ${GREEN}Admin@123${NC}"
echo -e "   • ${BOLD}Zone Admin  :${NC} username: ${GREEN}zoneadmin_s9${NC}   | password: ${GREEN}Admin@123${NC}"
echo -e "   • ${BOLD}Surveyor    :${NC} username: ${GREEN}surveyor_s9_01${NC} | password: ${GREEN}Password@123${NC}"
echo -e "   • ${BOLD}Contractor  :${NC} username: ${GREEN}contractor_guest${NC}| password: ${GREEN}Password@123${NC}"
echo ""
echo -e "${YELLOW}${BOLD}💡 Mẹo: Nhấn [Ctrl + C] bất cứ lúc nào để dừng toàn bộ hệ thống sạch sẽ.${NC}"
echo -e "${CYAN}${BOLD}====================================================================${NC}"
echo ""

# Tự động mở trình duyệt trên macOS nếu có lệnh 'open'
if command -v open &> /dev/null; then
    open "http://localhost:3000" > /dev/null 2>&1 || true
fi

# Giữ tiến trình để theo dõi logs và xử lý lệnh tắt
wait $BACKEND_PID $FRONTEND_PID
