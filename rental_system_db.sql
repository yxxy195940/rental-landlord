-- 简化版房租管理系统数据库设计

-- 1. 用户表（统一管理房东和租客）
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(20) UNIQUE NOT NULL COMMENT '手机号',
    password VARCHAR(255) COMMENT '密码（房东使用）',
    name VARCHAR(100) COMMENT '姓名',
    user_type TINYINT NOT NULL DEFAULT 2 COMMENT '用户类型：1-房东 2-租客',
    wechat_openid VARCHAR(100) COMMENT '微信openid',
    avatar VARCHAR(500) COMMENT '头像',
    status TINYINT DEFAULT 1 COMMENT '状态：0-禁用 1-正常',
    last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_user_type (user_type)
) COMMENT='用户表';

-- 2. 房产表（简化版，支持公寓/楼栋）
CREATE TABLE properties (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    landlord_id BIGINT NOT NULL COMMENT '房东ID',
    name VARCHAR(200) NOT NULL COMMENT '房产名称',
    address VARCHAR(500) NOT NULL COMMENT '详细地址',
    total_rooms INT DEFAULT 0 COMMENT '总房间数',
    remark TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_landlord (landlord_id),
    FOREIGN KEY (landlord_id) REFERENCES users(id)
) COMMENT='房产表';

-- 3. 房间表（核心表）
CREATE TABLE rooms (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    property_id BIGINT NOT NULL COMMENT '房产ID',
    room_name VARCHAR(100) NOT NULL COMMENT '房间名称/编号',
    status TINYINT DEFAULT 1 COMMENT '状态：1-空置 2-已出租 3-维修中',

    -- 租客信息（简化绑定）
    tenant_id BIGINT COMMENT '当前租客ID',
    tenant_phone VARCHAR(20) COMMENT '租客手机号',
    rent_start_date DATE COMMENT '起租日期',

    -- 费用配置
    monthly_rent DECIMAL(10,2) DEFAULT 0 COMMENT '月租金',
    cleaning_fee DECIMAL(10,2) DEFAULT 0 COMMENT '卫生费/月',
    water_price DECIMAL(10,2) DEFAULT 0 COMMENT '水费单价（元/吨）',
    electricity_price DECIMAL(10,2) DEFAULT 0 COMMENT '电费单价（元/度）',
    other_fees JSON COMMENT '其他固定费用 [{name, amount}]',

    -- 水电表基数
    last_water_reading DECIMAL(10,2) DEFAULT 0 COMMENT '上次水表读数',
    last_electricity_reading DECIMAL(10,2) DEFAULT 0 COMMENT '上次电表读数',

    remark TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_property (property_id),
    INDEX idx_status (status),
    INDEX idx_tenant (tenant_id),
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (tenant_id) REFERENCES users(id)
) COMMENT='房间表';

-- 4. 抄表记录表（简化版）
CREATE TABLE meter_readings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    room_id BIGINT NOT NULL COMMENT '房间ID',
    reading_month VARCHAR(7) NOT NULL COMMENT '抄表月份（YYYY-MM）',

    -- 本期读数
    water_reading DECIMAL(10,2) NOT NULL COMMENT '水表读数',
    electricity_reading DECIMAL(10,2) NOT NULL COMMENT '电表读数',

    -- 上期读数（冗余存储，方便计算）
    prev_water_reading DECIMAL(10,2) COMMENT '上期水表读数',
    prev_electricity_reading DECIMAL(10,2) COMMENT '上期电表读数',

    -- 用量（自动计算）
    water_usage DECIMAL(10,2) COMMENT '用水量',
    electricity_usage DECIMAL(10,2) COMMENT '用电量',

    reading_date DATE COMMENT '抄表日期',
    images JSON COMMENT '水电表照片 [{type, url}]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_room_month (room_id, reading_month),
    INDEX idx_month (reading_month),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
) COMMENT='抄表记录表';

-- 5. 账单表（自动生成）
CREATE TABLE bills (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bill_no VARCHAR(50) UNIQUE NOT NULL COMMENT '账单编号',
    room_id BIGINT NOT NULL COMMENT '房间ID',
    tenant_id BIGINT NOT NULL COMMENT '租客ID',
    bill_month VARCHAR(7) NOT NULL COMMENT '账单月份（YYYY-MM）',

    -- 费用明细
    rent_amount DECIMAL(10,2) DEFAULT 0 COMMENT '租金',
    water_amount DECIMAL(10,2) DEFAULT 0 COMMENT '水费',
    electricity_amount DECIMAL(10,2) DEFAULT 0 COMMENT '电费',
    cleaning_amount DECIMAL(10,2) DEFAULT 0 COMMENT '卫生费',
    other_details JSON COMMENT '其他费用明细 [{name, amount}]',
    total_amount DECIMAL(10,2) NOT NULL COMMENT '总金额',

    -- 关联抄表
    meter_reading_id BIGINT COMMENT '关联的抄表记录ID',

    -- 支付信息
    status TINYINT DEFAULT 1 COMMENT '状态：1-待支付 2-已支付 3-已作废',
    paid_amount DECIMAL(10,2) DEFAULT 0 COMMENT '已付金额',
    paid_at TIMESTAMP NULL COMMENT '支付时间',
    payment_method VARCHAR(50) COMMENT '支付方式：cash/wechat/alipay/bank',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_room_month (room_id, bill_month),
    INDEX idx_tenant_status (tenant_id, status),
    INDEX idx_month (bill_month),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (tenant_id) REFERENCES users(id),
    FOREIGN KEY (meter_reading_id) REFERENCES meter_readings(id)
) COMMENT='账单表';

-- 6. 收据表（支付凭证）
CREATE TABLE receipts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    receipt_no VARCHAR(50) UNIQUE NOT NULL COMMENT '收据编号',
    bill_id BIGINT NOT NULL COMMENT '账单ID',
    amount DECIMAL(10,2) NOT NULL COMMENT '实收金额',
    payment_method VARCHAR(50) NOT NULL COMMENT '支付方式',
    transaction_no VARCHAR(100) COMMENT '交易流水号',
    payer_name VARCHAR(100) COMMENT '付款人姓名',
    receipt_date DATE NOT NULL COMMENT '收款日期',
    remark TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bill (bill_id),
    INDEX idx_date (receipt_date),
    FOREIGN KEY (bill_id) REFERENCES bills(id)
) COMMENT='收据表';

-- 7. 消息通知表（简化版）
CREATE TABLE notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    type VARCHAR(50) NOT NULL COMMENT '类型：bill_created/payment_remind',
    title VARCHAR(200) NOT NULL COMMENT '标题',
    content TEXT COMMENT '内容',
    target_id BIGINT COMMENT '关联ID（如账单ID）',
    is_read TINYINT DEFAULT 0 COMMENT '是否已读',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_unread (user_id, is_read),
    FOREIGN KEY (user_id) REFERENCES users(id)
) COMMENT='消息通知表';

-- 8. 快速设置模板（帮助房东快速配置）
CREATE TABLE fee_templates (
                               id BIGINT PRIMARY KEY AUTO_INCREMENT,
                               landlord_id BIGINT NOT NULL COMMENT '房东ID',
                               name VARCHAR(100) NOT NULL COMMENT '模板名称',
                               monthly_rent DECIMAL(10,2) DEFAULT 0 COMMENT '月租金',
                               cleaning_fee DECIMAL(10,2) DEFAULT 0 COMMENT '卫生费',
                               water_price DECIMAL(10,2) DEFAULT 0 COMMENT '水费单价',
                               electricity_price DECIMAL(10,2) DEFAULT 0 COMMENT '电费单价',
                               other_fees JSON COMMENT '其他费用项',
                               is_default TINYINT DEFAULT 0 COMMENT '是否默认',
                               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                               INDEX idx_landlord (landlord_id),
                               FOREIGN KEY (landlord_id) REFERENCES users(id)
) COMMENT='费用模板表';

-- 创建必要的触发器
#
# DELIMITER $$
#
# -- 抄表后自动更新房间的最新读数
# CREATE TRIGGER update_room_readings
# AFTER INSERT ON meter_readings
# FOR EACH ROW
# BEGIN
#     UPDATE rooms
#     SET last_water_reading = NEW.water_reading,
#         last_electricity_reading = NEW.electricity_reading
#     WHERE id = NEW.room_id;
# END$$

-- 账单支付后自动生成收据
# CREATE TRIGGER auto_create_receipt
# AFTER UPDATE ON bills
# FOR EACH ROW
# BEGIN
#     IF NEW.status = 2 AND OLD.status = 1 THEN
#         INSERT INTO receipts (
#             receipt_no,
#             bill_id,
#             amount,
#             payment_method,
#             receipt_date
#         ) VALUES (
#             CONCAT('R', DATE_FORMAT(NOW(), '%Y%m%d'), LPAD(NEW.id, 6, '0')),
#             NEW.id,
#             NEW.paid_amount,
#             NEW.payment_method,
#             CURDATE()
#         );
#     END IF;
# END$$

# DELIMITER ;