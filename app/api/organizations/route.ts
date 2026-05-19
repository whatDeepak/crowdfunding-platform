import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createOrganization, getOrganizationByUserId, supabase } from '@/lib/supabase';
import type { OrgStatus } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status    = (searchParams.get('status') ?? 'active') as OrgStatus;
    const q         = searchParams.get('q')?.trim() ?? '';
    const domain    = searchParams.get('domain') ?? '';
    const orgType   = searchParams.get('org_type') ?? '';
    const geoScope  = searchParams.get('geographic_scope') ?? '';
    const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const perPage   = Math.min(20, Math.max(1, parseInt(searchParams.get('per_page') ?? '6')));
    const offset    = (page - 1) * perPage;

    let query = supabase
      .from('organizations')
      .select('*', { count: 'exact' })
      .eq('status', status);

    if (q) {
      query = query.or(
        `org_name.ilike.%${q}%,responsible_person.ilike.%${q}%,org_type.ilike.%${q}%,registration_number.ilike.%${q}%`
      );
    }
    if (domain) {
      // jsonb contains: domains array must include the given domain string
      query = query.contains('domains', JSON.stringify([domain]));
    }
    if (orgType)  query = query.eq('org_type', orgType);
    if (geoScope) query = query.eq('geographic_scope', geoScope);

    query = query
      .order('tier',               { ascending: true })
      .order('total_endorsements', { ascending: false })
      .range(offset, offset + perPage - 1);

    const { data: orgs, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      orgs:        orgs ?? [],
      total:       count ?? 0,
      page,
      per_page:    perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    });
  } catch (error) {
    console.error('GET /api/organizations error:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createSupabaseServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // One org per user
    const existing = await getOrganizationByUserId(user.id);
    if (existing) {
      return NextResponse.json(
        { error: 'You have already registered an organization', org: existing },
        { status: 409 }
      );
    }

    const body = await request.json();
    const {
      org_name,
      org_type,
      registration_number,
      registration_doc_ipfs,
      secondary_doc_ipfs,
      website_url,
      responsible_person,
      geographic_scope,
      domains,
    } = body;

    if (!org_name || !org_type || !registration_number || !responsible_person || !geographic_scope || !domains?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const org = await createOrganization({
      user_id:              user.id,
      org_name:             org_name.trim(),
      org_type,
      registration_number:  registration_number.trim(),
      registration_doc_ipfs,
      website_url:          website_url?.trim() || undefined,
      contact_email:        user.email,
      responsible_person:   responsible_person.trim(),
      geographic_scope,
      domains,
    });

    if (!org) {
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
    }

    return NextResponse.json(org, { status: 201 });
  } catch (error) {
    console.error('POST /api/organizations error:', error);
    return NextResponse.json({ error: 'Failed to register organization' }, { status: 500 });
  }
}
