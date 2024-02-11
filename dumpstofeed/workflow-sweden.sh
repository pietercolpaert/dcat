FEEDNAME=sweden
DUMPFILENAME=tmp123-sweden.ttl
DUMPURL=https://admin.dataportal.se/all.rdf

# Create the directory if it doesn’t exist yet, and consequentially, create the feed.ttl root file.
[ -d $FEEDNAME ] || mkdir $FEEDNAME
[ -s $FEEDNAME/feed.ttl ] && cat > $FEEDNAME/feed.ttl << EOF
@prefix as: <https://www.w3.org/ns/activitystreams#>.
@prefix dcat: <http://www.w3.org/ns/dcat#>.
@prefix tree: <https://w3id.org/tree#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix ldes: <https://w3id.org/ldes#>.

<feed> a ldes:EventStream ;
    ldes:timestampPath as:published ;
    ldes:versionOfPath as:object ;
    tree:view <feed.ttl> .
EOF

# Next, we fetch the (new) dump
npx ldfetch $DUMPURL > $DUMPFILENAME
# assuming we will only fetch updates each day, we can name the files according to today’s date
ts-node bin/dumpsToFeed.ts $FEEDNAME $DUMPFILENAME > $FEEDNAME/$(date +'%Y-%m-%d').trig
# If they file isn’t empty, add relations to the file from the feed.ttl. Remove the file if it’s empty as that means there are no updates for today. 
[ -s $FEEDNAME/$(date +'%Y-%m-%d').trig ] && { cat >> $FEEDNAME/feed.ttl << EOF
<feed.ttl> tree:relation [
        a tree:GreaterThanOrEqualToRelation ;
        tree:path as:published ;
        tree:value "$(date +'%Y-%m-%d')T00:00:00Z"^^xsd:dateTime ;
        tree:node <$(date +'%Y-%m-%d').trig>
    ] ,
    [
        a tree:LessThanOrEqualToRelation ;
        tree:path as:published ;
        tree:value  "$(date +'%Y-%m-%d')T23:59:99Z"^^xsd:dateTime ;
        tree:node <$(date +'%Y-%m-%d').trig>
    ]
EOF
}|| rm $FEEDNAME/$(date +'%Y-%m-%d').trig

# Remove the dump file as we won’t need it anymore and it’s nice to have a clean repo
rm $DUMPFILENAME

## Wrt the design choice we took here:
##  - page size should be equal to the duration of your recommended catch up time. 
##  - E.G., if you want data portals to catch up once per day, your changes should be paginated per day.