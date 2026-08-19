'use strict';

/**
 * Group Service
 * 그룹 = 기존 Site 개념 위에 얹는 멤버십 레이어
 * - 그룹 제작: OWNER가 되고 10자리 초대코드 자동 생성
 * - 그룹 참여: 초대코드 입력 → VIEWER로 자동 가입
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb } = require('../adapters/DatabaseRegistry');
const logger = require('../utils/logger');

// Map<inviteCode, siteId>
const inviteCodes = new Map();
// Map<siteId, inviteCode>
const siteInviteIndex = new Map();

/**
 * 10자리 랜덤 초대코드 생성 (대소문자+숫자)
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * 그룹 생성 — 사이트 생성 + 초대코드 발급
 */
async function createGroup({ name, slug, domain, ownerId }) {
  const db = getDb();

  // 슬러그 자동 생성 (이름 기반)
  const autoSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 32) + '-' + uuidv4().slice(0, 6);

  const site = await db.createSite({
    id: uuidv4(),
    name,
    slug: autoSlug,
    domain: domain || '',
    ownerId,
  });

  // 초대코드 생성 및 저장
  let code;
  do { code = generateInviteCode(); } while (inviteCodes.has(code));
  inviteCodes.set(code, site.id);
  siteInviteIndex.set(site.id, code);

  logger.audit('GROUP_CREATE', { userId: ownerId, siteId: site.id, name });

  return { site, inviteCode: code };
}

/**
 * 초대코드로 그룹 참여
 */
async function joinGroup({ inviteCode, userId }) {
  const siteId = inviteCodes.get(inviteCode);
  if (!siteId) {
    throw Object.assign(new Error('유효하지 않은 초대코드입니다.'), { status: 404 });
  }

  const db = getDb();

  // 이미 멤버인지 확인
  const existing = await db.getSiteAccess(userId, siteId);
  if (existing) {
    throw Object.assign(new Error('이미 이 그룹의 멤버입니다.'), { status: 409 });
  }

  const site = await db.getSiteById(siteId);
  if (!site || !site.active) {
    throw Object.assign(new Error('그룹을 찾을 수 없습니다.'), { status: 404 });
  }

  await db.grantSiteAccess({ userId, siteId, role: 'VIEWER' });

  logger.audit('GROUP_JOIN', { userId, siteId, inviteCode: inviteCode.slice(0, 3) + '***' });

  return { site };
}

/**
 * 그룹 초대코드 조회 (OWNER만)
 */
function getInviteCode(siteId) {
  return siteInviteIndex.get(siteId) || null;
}

/**
 * 초대코드 재발급
 */
function rotateInviteCode(siteId) {
  const oldCode = siteInviteIndex.get(siteId);
  if (oldCode) inviteCodes.delete(oldCode);

  let code;
  do { code = generateInviteCode(); } while (inviteCodes.has(code));
  inviteCodes.set(code, siteId);
  siteInviteIndex.set(siteId, code);

  return code;
}

module.exports = { createGroup, joinGroup, getInviteCode, rotateInviteCode };
