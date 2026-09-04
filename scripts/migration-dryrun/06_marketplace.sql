-- Marketplace (0011). These are the FIRST public reads in CAConnect, so the
-- questions are: does an unpublished profile leak, do its children leak with
-- it, and can anon reach anything it should not.
\set ON_ERROR_STOP off

-- CA One creates a profile, a package and a booking. Unpublished to begin.
set role authenticated;
set app.current_user_id = '11111111-1111-1111-1111-111111111111';

insert into ca_profiles (id, firm_id, slug, display_name, city, is_published, specialisations)
values ('cafe0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
        'ca-one-pune','CA One & Co','Pune', false, '{itr,gstr1}');

insert into ca_packages (id, firm_id, profile_id, title, price_paise, service_type)
values ('bbbb0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
        'cafe0000-0000-0000-0000-000000000001','Company Registration', 1500000, 'company_registration');

reset role;
insert into bookings (id, firm_id, profile_id, token, contact_name, contact_email, quoted_amount_paise, commission_paise)
values ('dddd0000-0000-0000-0000-00000000000b','11111111-1111-1111-1111-111111111111',
        'cafe0000-0000-0000-0000-000000000001','tok_booking_one','Arjun','arjun@example.com', 1000000, 80000);
insert into reviews (booking_id, firm_id, profile_id, rating, reviewer_name, body)
values ('dddd0000-0000-0000-0000-00000000000b','11111111-1111-1111-1111-111111111111',
        'cafe0000-0000-0000-0000-000000000001', 5, 'Arjun', 'Great work');

\echo '=== 1. UNPUBLISHED: anon sees no profile (expect 0) ==='
set role anon;
select count(*) as visible from ca_profiles;

\echo '=== 2. unpublished profile hides its packages too (expect 0) ==='
select count(*) as visible from ca_packages;

\echo '=== 3. ...and its reviews (expect 0) ==='
select count(*) as visible from reviews;

\echo '=== 4. ...and the ratings view, which must not bypass RLS (expect 0) ==='
select count(*) as visible from ca_profile_ratings;

\echo '=== 5. anon can NEVER read a booking — it holds consumer contact details (expect 0) ==='
select count(*) as leaked from bookings;

\echo '=== 6. now publish it ==='
reset role;
update ca_profiles set is_published = true where slug = 'ca-one-pune';

\echo '=== 7. PUBLISHED: anon sees the profile, package, review and rating (expect 1,1,1,1) ==='
set role anon;
select 'profiles' as t, count(*) from ca_profiles
union all select 'packages', count(*) from ca_packages
union all select 'reviews', count(*) from reviews
union all select 'ratings', count(*) from ca_profile_ratings
order by 1;

\echo '=== 8. anon still cannot read bookings (expect 0) ==='
select count(*) as leaked from bookings;

\echo '=== 9. anon cannot publish itself a profile (expect RLS violation) ==='
insert into ca_profiles (firm_id, slug, display_name, is_published)
values ('11111111-1111-1111-1111-111111111111','anon-hacker','Hacker', true);

\echo '=== 10. anon cannot edit a published profile (expect UPDATE 0) ==='
update ca_profiles set display_name = 'HACKED' where slug = 'ca-one-pune';

\echo '=== 11. anon cannot write a review without a booking (expect RLS violation) ==='
insert into reviews (booking_id, firm_id, profile_id, rating, reviewer_name)
values ('dddd0000-0000-0000-0000-00000000000b','11111111-1111-1111-1111-111111111111',
        'cafe0000-0000-0000-0000-000000000001', 1, 'Spammer');

\echo '=== 12. a CA cannot edit or delete reviews of itself (expect UPDATE 0, DELETE 0) ==='
set role authenticated;
set app.current_user_id = '11111111-1111-1111-1111-111111111111';
update reviews set rating = 5, body = 'Actually amazing' where reviewer_name = 'Arjun';
delete from reviews where reviewer_name = 'Arjun';

\echo '=== 13. CA Two cannot touch CA One''s profile (expect UPDATE 0) ==='
set app.current_user_id = '22222222-2222-2222-2222-222222222222';
update ca_profiles set display_name = 'STOLEN' where slug = 'ca-one-pune';

\echo '=== 14. CA Two cannot read CA One''s bookings, even though the profile is public (expect 0) ==='
select count(*) as leaked from bookings;

\echo '=== 15. one review per booking — a second is refused (expect unique violation) ==='
reset role;
insert into reviews (booking_id, firm_id, profile_id, rating, reviewer_name)
values ('dddd0000-0000-0000-0000-00000000000b','11111111-1111-1111-1111-111111111111',
        'cafe0000-0000-0000-0000-000000000001', 1, 'Arjun again');

\echo '=== 16. a review cannot exist without a booking (expect FK violation) ==='
insert into reviews (booking_id, firm_id, profile_id, rating, reviewer_name)
values ('dddd0000-0000-0000-0000-0000000000ff','11111111-1111-1111-1111-111111111111',
        'cafe0000-0000-0000-0000-000000000001', 5, 'Ghost');

\echo '=== 17. commission is basis points, and out-of-range is refused (expect check violation) ==='
insert into bookings (firm_id, profile_id, token, contact_name, contact_email, commission_rate_bps)
values ('11111111-1111-1111-1111-111111111111','cafe0000-0000-0000-0000-000000000001',
        'tok_bad_bps','X','x@example.com', 10001);

\echo '=== 18. slug must be url-safe (expect check violation) ==='
insert into ca_profiles (firm_id, slug, display_name)
values ('22222222-2222-2222-2222-222222222222','Not A Slug!','Bad');

\echo '=== 19. one profile per firm (expect unique violation) ==='
insert into ca_profiles (firm_id, slug, display_name)
values ('11111111-1111-1111-1111-111111111111','ca-one-second','Second profile');

\echo '=== 20. anon books a PUBLISHED profile through the function (expect a uuid) ==='
set role anon;
select create_booking(
  'cafe0000-0000-0000-0000-000000000001', 'tok_anon_booking_1',
  'Priya Consumer', 'priya@example.com',
  'bbbb0000-0000-0000-0000-000000000001'
) is not null as booked;

\echo '=== 21. price and commission came from the package, not the caller (expect 1500000 / 120000) ==='
reset role;
select quoted_amount_paise, commission_paise, commission_rate_bps, status, firm_id
  from bookings where token = 'tok_anon_booking_1';

\echo '=== 22. anon cannot book an UNPUBLISHED profile (expect exception) ==='
update ca_profiles set is_published = false where slug = 'ca-one-pune';
set role anon;
select create_booking('cafe0000-0000-0000-0000-000000000001','tok_nope','X','x@example.com');

\echo '=== 23. republish, then a bad email is refused (expect exception) ==='
reset role;
update ca_profiles set is_published = true where slug = 'ca-one-pune';
set role anon;
select create_booking('cafe0000-0000-0000-0000-000000000001','tok_bad','X','not-an-email');

\echo '=== 24. a package from ANOTHER profile is refused (expect exception) ==='
select create_booking('cafe0000-0000-0000-0000-000000000001','tok_x','X','x@example.com',
                      '99999999-0000-0000-0000-000000000009');

\echo '=== 25. booking_by_token returns the consumer''s own row, without commission ==='
select status, contact_name, quoted_amount_paise, ca_display_name, package_title, has_review
  from booking_by_token('tok_anon_booking_1');

\echo '=== 26. a wrong token returns nothing (expect 0 rows) ==='
select count(*) as rows from booking_by_token('tok_wrong');

\echo '=== 27. cannot review before the CA marks it complete (expect exception) ==='
select create_review('tok_anon_booking_1', 5, 'Great', 'Lovely work');

\echo '=== 28. mark complete, then the review lands (expect a uuid) ==='
reset role;
update bookings set status = 'completed' where token = 'tok_anon_booking_1';
set role anon;
select create_review('tok_anon_booking_1', 5, 'Great', 'Lovely work') is not null as reviewed;

\echo '=== 29. reviewer name came from the booking, not from the caller ==='
reset role;
select rating, reviewer_name, is_published from reviews where title = 'Great';

\echo '=== 30. a second review on the same booking is refused (expect exception) ==='
set role anon;
select create_review('tok_anon_booking_1', 1, 'Changed my mind', 'Actually bad');

\echo '=== 31. an out-of-range rating is refused (expect exception) ==='
select create_review('tok_anon_booking_1', 9);
