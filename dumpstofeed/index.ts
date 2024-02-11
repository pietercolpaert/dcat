import rdfDereferencer from "rdf-dereference";
import {CBDShapeExtractor} from "extract-cbd-shape";
const {canonize} = require('rdf-canonize');
import { createHash } from 'node:crypto'
import N3 from 'n3';

// Helper function to make loading a quad stream in a store a promise
let loadQuadStreamInStore = function (store: N3.Store, quadStream: any) {
    return new Promise((resolve, reject) => {
      store.import(quadStream).on("end", resolve).on("error", reject);
    });
}

let processActivity = function (quads: Array<any>, type: N3.NamedNode, iri:N3.Term, hash:string) {
    // TODO: Instead of writing this to stdout as trig, we should use a JS Writer here of the connector architecture, so we can pipe it to an LDES server
    let writer = new N3.Writer({"format": "application/trig"});
    //create new IRI for the activity: based on the hash of the content? -- This means we assume the subject is a named node
    let subject = new N3.NamedNode(iri.value + "#" + hash);

    // Let’s call our LDES a relative IRI `feed`, assuming another script will put it in the right place and use that LDES IRI. We might make this configurable though.
    writer.addQuads([
        new N3.Quad(new N3.NamedNode("feed"),new N3.NamedNode("https://w3id.org/tree#member") , subject),
        new N3.Quad(subject, new N3.NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), type),
        new N3.Quad(subject, new N3.NamedNode("https://www.w3.org/ns/activitystreams#object"), iri),
        new N3.Quad(subject, new N3.NamedNode("https://www.w3.org/ns/activitystreams#published"), new N3.Literal("\"" + (new Date()).toISOString()+ "\"^^http://www.w3.org/2001/XMLSchema#dateTime")),
    ]);

    for (let quad of quads) {
        writer.addQuad(quad.subject,quad.predicate, quad.object, subject);
    }

    writer.end((error, result) => {
        console.log(result);
    });
}

export async function main (db:any, feedname:string, filename:string) {
    const store = new N3.Store();
    const { data } = await rdfDereferencer.dereference(filename, { localFiles: true });
    await loadQuadStreamInStore(store, data);
    //Todo: create a shape for the entities in the stream and let’s extract them accordingly
    let extractor = new CBDShapeExtractor();
    let subjects = getStandaloneEntitySubjects(store);

    for (let subject of subjects) {
        if (subject.termType === 'BlankNode') {
            console.error("A DCAT-AP embedded entity (type " + store.getObjects(subject, new N3.NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),null)[0].value + ") cannot be a blank node!");
            //Let’s skip this entity
            continue;
        }
        let entityquads = await extractor.extract(store, subject);
        // Alright! We got an entity!
        // Now let’s first create a hash to check whether the set of triples changed since last time.
        // We’ll use a library to make the entity description canonized -- see https://w3c.github.io/rdf-canon/spec/
        let canonizedString = await canonize(entityquads,{algorithm: 'RDFC-1.0'});
        //Now we can hash this string, for example with MD5
        let hashString = createHash('md5').update(canonizedString).digest('hex');
        //now let’s compare our hash with the hash in our leveldb key/val store.
        try {
            let previousHashString = await db.get(subject.value);            
            if (previousHashString !== hashString) {
                //An Update!
                processActivity(entityquads, new N3.NamedNode("https://www.w3.org/ns/activitystreams#Update"), subject, hashString);
                db.put(subject.value,hashString);
            } else {
                //Remained the same: do nothing
                //console.log("Remained the same", subject);
            }
        } catch (e) {
            processActivity(entityquads, new N3.NamedNode("https://www.w3.org/ns/activitystreams#Create"), subject, hashString);
            //PreviousHashString hasn’t been set, so let’s add a create in our stream
            db.put(subject.value,hashString);
        }
    }
    //We still need to detect deletions: something that has been in our leveldb previously, but isn’t anymore
    let keys = await db.keys().all();
    //loop over the keys and check whether they are set in the store. If there are keys that weren’t set before, it’s a deletion!
    for (let key of keys) {
        if (store.getQuads(new N3.NamedNode(key),null,null,null).length === 0) {
            processActivity([], new N3.NamedNode("https://www.w3.org/ns/activitystreams#Remove"), new N3.NamedNode(key), "remove-" + (new Date()).getSeconds());
            //and remove the entry in leveldb now so it doesn’t appear as removed twice in the feed on the next run
            db.del(key);
        }
    }
    //console.log(keys);
}


//Extract standalone entities according to the DCAT-AP Feeds spec:
//dcat:Catalog, dcat:Dataset, dcat:Distribution, dcat:DataService, foaf:Agent, vcard:Kind, dcterms:LicenseDocument
// Would be nice to make this configurable, so that we can use the script for other on-boardings as well.
let getStandaloneEntitySubjects = function (store: N3.Store) {
    let result:Array<N3.Term> = [];
    result = result.concat(store.getSubjects(null, new N3.NamedNode("http://www.w3.org/ns/dcat#Catalog"), null));
    result = result.concat(store.getSubjects(null, new N3.NamedNode("http://www.w3.org/ns/dcat#Dataset"), null));
    result = result.concat(store.getSubjects(null, new N3.NamedNode("http://www.w3.org/ns/dcat#Distribution"), null));
    result = result.concat(store.getSubjects(null, new N3.NamedNode("http://www.w3.org/ns/dcat#DataService"), null));
    result = result.concat(store.getSubjects(null, new N3.NamedNode("http://xmlns.com/foaf/0.1/"), null));
    result = result.concat(store.getSubjects(null, new N3.NamedNode("http://www.w3.org/2006/vcard/ns#Kind"), null));
    result = result.concat(store.getSubjects(null, new N3.NamedNode("http://purl.org/dc/terms/LicenseDocument"), null));
    return result;
}