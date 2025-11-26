import hashlib
from urllib.parse import unquote,unquote_plus


def ununquote(url):
    q = unquote_plus(url)
    q = unquote_plus(q)
    if len(q) > len(q.replace('%','')) + 3:
        q = unquote_plus(q)
    return q

def md5(text):
    enc = hashlib.md5()
    enc.update(text.encode())
    enc_text = enc.hexdigest()
    return enc_text

async def add_ad(conn, utm_source, utm_medium, utm_campaign, utm_content, utm_term,utm_id):
    if utm_id:
        hashed = md5(f'{utm_source}{utm_id}')
    else:
        hashed = md5(f'{utm_source}{utm_medium}{utm_campaign}{utm_content}{utm_term}')
    already_exist = await conn.fetchrow(
        """
            SELECT idx FROM ad_utm_info WHERE hash = $1
        """,hashed
    )
    if already_exist:
        return already_exist['idx']
    res = await conn.fetchrow(
        """
            INSERT INTO ad_utm_info
            (utm_source, utm_campaign, utm_medium, utm_term, utm_content,utm_id, hash)
            VALUES
            ($1,$2,$3,$4,$5,$6,$7)
            RETURNING idx
        """,utm_source, utm_campaign, utm_medium, utm_term, utm_content,utm_id, hashed
    )
    return res['idx']